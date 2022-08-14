import fetch from 'node-fetch';
import fs from 'fs';
import {setTimeout} from 'timers/promises';

const square = await buildSquare({lat: 32.0733, long: -109.0063}, {lat: 36.9674, long: -103.0298}, 10000);
fs.writeFileSync('./'+String(square.southWest.lat)+' '+String(square.southWest.long)+'  '+String(square.northEast.lat)+' '+String(square.northEast.long)+'.json', JSON.stringify(square, null, 1));

function printMap(square){
    const map = [...square.map];
    map.reverse();
    for (let line of map){
        let lineStr = '';
        for (let cell of line){
            lineStr+=String(Math.floor((cell.charCodeAt()*square.multipler+square.altBase)/1000)).padStart(2, ' ');
        }
        console.log(lineStr);
    }
}

function isBadLatLong(lat, long){
    if (lat<=-90 || lat>=90 || long<-180 || long>180) return true;
    return false;
}

//TODO manage crossing the -180/180 boundary (e.g. go from 180 long to -179 long)

/**
 * 
 * @param {{lat: number, long: number}} southWest 
 * @param {{lat: number, long: number}} northEast 
 * @param {number} desiredAccuracy in feet
 * @returns 
 */
async function buildSquare(southWest, northEast, desiredAccuracy = 303.806){
    if (desiredAccuracy<101.27) desiredAccuracy=101.27;

    if (!southWest || !northEast){
        console.log('error, southWest and northEast must be an object with lat and long properties')
        return null;
    }
    
    if (isBadLatLong(southWest.lat, southWest.long) || isBadLatLong(northEast.lat, northEast.long)){
        console.log('error, bad lat long coords');
        return null;
    }
    if (southWest.lat>northEast.lat){
        const temp=southWest.lat;
        southWest.lat=northEast.lat;
        northEast.lat=temp;
    }
    if (southWest.long>northEast.long){
        const temp=southWest.long;
        southWest.long=northEast.long;
        northEast.long=temp;
    }
    
    const latDegreeDiff = Math.abs(southWest.lat-northEast.lat);
    const longDegreeDiff = Math.abs(southWest.long-northEast.long);
    
    const arcSecond = 1/3600;
    if (latDegreeDiff<arcSecond || longDegreeDiff<arcSecond){
        console.log('error, latitudes and longitudes must be more than 1 arc second apart');
        return null;
    }

    //1 arcsecond of latitude = 101.27ft
    //1 arcsecond of longitude at equator = 101.27ft
    let widestLatitude = 0;
    if (southWest.lat>0 && northEast.lat>0){
        widestLatitude=southWest.lat;
    } else if (southWest.lat<0 && northEast.lat<0){
        widestLatitude=northEast.lat;
    }


    const arcSecondsPerStep = desiredAccuracy/101.27;
    
    const latArcSeconds = latDegreeDiff*3600;
    const longArcSeconds = longDegreeDiff*3600;

    const square = {southWest, northEast, altBase: null, multipler: null, accuracy: desiredAccuracy, arcSecondsPerStep: arcSecondsPerStep};
    const map = [];
    
    let lowest=null;
    let highest=null;
    let latWriteIndex = 0;
    let maxProgessTicks = ((latArcSeconds+arcSecondsPerStep)/arcSecondsPerStep)*((longArcSeconds+arcSecondsPerStep)/arcSecondsPerStep);
    let currentProgress = 0;
    for (let currentLatBase = 0; (currentLatBase <= latArcSeconds+arcSecondsPerStep); currentLatBase += arcSecondsPerStep){
        const fetchPromises=[];
        for (let currentLongBase = 0; (currentLongBase <= longArcSeconds+arcSecondsPerStep); currentLongBase += arcSecondsPerStep){
            const getLat = southWest.lat + currentLatBase/3600;
            const getLong = southWest.long + currentLongBase/3600;
            fetchPromises.push(fetchElevation(getLat, getLong));
        }
        let allSettled=false;
        while (allSettled === false){
            const settled = await Promise.allSettled(fetchPromises);

            allSettled=true;
            for (const [index, result] of settled.entries()){
                if (result.status==='fulfilled'){
                    currentProgress++;
                    fetchPromises[index]=result.value;
                    if (lowest===null || result.value<lowest) lowest=result.value;
                    if (highest===null || result.value>highest) highest=result.value;
                }else{
                    allSettled=false;
                    fetchPromises[index]=result.reason;
                }
            }
        }
        console.log('Progress: '+Math.round(currentProgress/maxProgessTicks*100)+'%');
        map[latWriteIndex++]=[...fetchPromises];
    }
    square.altBase=lowest;
    square.multipler=(highest-lowest)/223;
    for (const [latIndex, longArray] of map.entries()){
        for (const [longIndex, elevation] of longArray.entries()){
            map[latIndex][longIndex] = 32+Math.floor((elevation-lowest)/square.multipler);
        }
        map[latIndex] = String.fromCharCode(...map[latIndex]);
    }
    square.map=map;
    
    return square;
}



function fetchElevation(lat, long, count=0){
    lat=Math.round(lat*1000000)/1000000;
    long=Math.round(long*1000000)/1000000;

    return setTimeout(Math.random(1)*(2000*(count+1))).then( ()=>{
        const controller = new AbortController();
        const timeout = setTimeout(() => {
            controller.abort();
        }, 1000+Math.min(count*1000, 5000));
        return fetch('https://nationalmap.gov/epqs/pqs.php?units=feet&output=json&x='+long+'&y='+lat+'callback=JSON_CALLBACK', {signal: controller.signal}).then( response => {
            return response.json();
        }).then(result => {
            const q=result.USGS_Elevation_Point_Query_Service.Elevation_Query;
            return Promise.resolve(Number(q.Elevation));
        }).catch( error => {
            console.log('error fetching #'+count, lat, long, 'retrying...');
            return fetchElevation(lat, long, count+1);
        }).finally( () => {
            clearTimeout(timeout);
        });
    })
}