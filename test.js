import { createRequire } from "module";
const require = createRequire(import.meta.url);

const blocks=[require('./03000 34.6 -107.5  35.4 -106.533.json')];

console.log(getElevation(35.042787, -106.605663));//KABQ
console.log(getElevation(35.1437, -106.7942));//KAEG
console.log(getElevation(35.049322, -107.186222));//Some random mesa
console.log(getElevation(34.861003, -107.161932));//Site 18
console.log(getElevation(34.767281, -107.443113));//Papa
console.log(getElevation(34.781523, -107.428007));//Oscar

function bilinearInterp(x, y, x2, y2, tl, tr, bl, br, px, py){
    const r1=Math.abs((px-x)*(py-y));
    const r2=Math.abs((x2-px)*(py-y));
    const r3=Math.abs((px-x)*(y2-py));
    const r4=Math.abs((x2-px)*(y2-py));
    const totalArea=r1+r2+r3+r4;
    const r1p=r4/totalArea;
    const r2p=r3/totalArea;
    const r3p=r2/totalArea;
    const r4p=r1/totalArea;
    return (r1p*tl)+(r2p*tr)+(r3p*bl)+(r4p*br);
}


function getElevationFromBlock(block, lat, long){
    const getBlockValue = (la, lo) => (block.map[la].charCodeAt(lo)-32)*block.multipler+block.altBase+block.multipler/2;

    const latArcSeconds = (lat-block.southWest.lat)*3600;
    const longArcSeconds = (long-block.southWest.long)*3600;
    
    const latIndex = Math.trunc(latArcSeconds/block.arcSecondsPerStep);
    const longIndex = Math.trunc(longArcSeconds/block.arcSecondsPerStep);

    const tlVal = getBlockValue(latIndex+1, longIndex);
    const trVal = getBlockValue(latIndex+1, longIndex+1);
    const brVal = getBlockValue(latIndex, longIndex+1);
    const blVal = getBlockValue(latIndex, longIndex);

    const x=(longArcSeconds-(longIndex*block.arcSecondsPerStep))/block.arcSecondsPerStep;
    const y=(latArcSeconds-(latIndex*block.arcSecondsPerStep))/block.arcSecondsPerStep;

    return bilinearInterp(0, 0, 1, 1, blVal, brVal, tlVal, trVal, x, y);
}

function getElevation(lat, long){
    const listOfMatchedBlocks=[];
    for (const block of blocks){
        if (lat>=block.southWest.lat && lat<=block.northEast.lat){
            if (long>=block.southWest.long && long<=block.northEast.long){
                listOfMatchedBlocks.push(block);
            }
        }
    }
    if (listOfMatchedBlocks.length){
        listOfMatchedBlocks.sort( (a, b) => a.accuracy - b.accuracy);
        return getElevationFromBlock(listOfMatchedBlocks[0], lat, long);
    }
    return null;
}