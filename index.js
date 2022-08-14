import fetch from 'node-fetch';


console.log(feetPerArcSecondAt(0));
console.log(feetPerArcSecondAt(35));
const s35latN107long = await buildSquare(35, -107, 6076*2);
console.log(JSON.stringify(s35latN107long));
/**
 * 
 * @param {number} latSouthDegree south boundary of square (-90 to 89)
 * @param {number} longWestDegree west boundary of sqaure (-180 to 179)
 * @returns {Object{id: string, multiplier: number, map: []}} returns object with id of the square and an array of arrays that contain elevation of each second (degree, minute, second) for sqaure
 */

function feetPerArcSecondAt(latitude){
    return Math.cos(Math.abs(latitude)/57.2958) * 101.268591427165;
}

async function buildSquare(latSouthDegree, longWestDegree, desiredMinAccuracy = 1000){//Goes east and north from latDegree, longDegree
    const latDegree = Math.trunc(latSouthDegree);
    const longDegree = Math.trunc(longWestDegree);
    if (latDegree>=89 || longDegree>=179){
        console.error("latDegree needs to be less than 89 and longDegree needs to be less than 179");
        return null;
    }
    
    let divider = 1;
    let actualMinAccuracyFt;
    const feetPerArcSecond = Math.round(feetPerArcSecondAt(latDegree <= 0 ? latDegree : latDegree + 1));
    if (desiredMinAccuracy<=feetPerArcSecond){
        divider=1;
        actualMinAccuracyFt=feetPerArcSecond;
    }else{
        divider=Math.round(desiredMinAccuracy / feetPerArcSecond);
        while (3600 % divider){
            divider++;
        }
        actualMinAccuracyFt=divider*feetPerArcSecond;
    }
    console.log(actualMinAccuracyFt);
    const square = {id: {lat: latDegree, long: longDegree}, minAccuracy: actualMinAccuracyFt, base: null, multipler: null, map: []};

    const map=[];
    let lowest=null;
    let highest=null;
    let maxProgress=(3600/divider+1)**2;
    let progess=0;
    for (let latArcSeconds = 0; latArcSeconds<=3600; latArcSeconds+=divider){
        const line=[];
        for (let longArcSeconds = 0; longArcSeconds<=3600; longArcSeconds+=divider){
            let elevation = null;
            while (elevation===null){
                elevation = await fetchElevation(latDegree+latArcSeconds/3600, longDegree+longArcSeconds/3600);
                if (elevation===null){
                    console.log('retrying...');
                }
            }
            if (lowest===null || elevation<lowest) lowest=elevation;
            if (highest===null || elevation>highest) highest=elevation;
            line.push(elevation);
            progess++;
            console.log("progress: ",Math.floor(progess/maxProgress*100)+'%');
        }
        map.push(line);
    }
    
    square.base=lowest;
    square.multipler=(highest-lowest)/223;
    console.log(square.multipler);
    for (const line of map){
        let lineStr = '';
        for (const cell of line){
            lineStr+=String.fromCharCode(32+Math.floor((cell-lowest)/square.multipler));
        }
        square.map.push(lineStr);
        console.log(lineStr);
    }

    return square;

}



function fetchElevation(lat, long, count=0){
    lat=Math.round(lat*100000)/100000;
    long=Math.round(long*100000)/100000;
    return fetch('https://nationalmap.gov/epqs/pqs.php?units=feet&output=json&x='+long+'&y='+lat+'callback=JSON_CALLBACK').then( response => {
        return response.json();
    }).then(result => {
        const q=result.USGS_Elevation_Point_Query_Service.Elevation_Query;
        return Promise.resolve(Number(q.Elevation));
    }).catch( error => {
        console.log('error fetching #'+count, lat, long, 'retrying...');
        return fetchElevation(lat, long, count+1);
    });
}