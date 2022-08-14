import { createRequire } from "module";
const require = createRequire(import.meta.url);

const blocks=[require('./34.6 -107.5  35.4 -106.533.json')];

console.log(getElevation(35.0433, -106.6129));

function getElevationFromBlock(block, lat, long){
    const latArcSeconds = (lat-block.southWest.lat)*3600;
    const longArcSeconds = (long-block.southWest.long)*3600;
    
    const latIndex = Math.trunc(latArcSeconds/block.arcSecondsPerStep);
    const longIndex = Math.trunc(longArcSeconds/block.arcSecondsPerStep);

    return block.map[latIndex].charCodeAt(longIndex)*block.multipler+block.altBase;
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