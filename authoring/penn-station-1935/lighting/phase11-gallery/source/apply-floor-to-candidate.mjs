import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {applyFloorMaterial} from '/Users/stavreskimario/Desktop/penn-station-work/phase11-arrivals-finish/materials/apply_floor_material.mjs';
const[input,output,materialDirectory,variant,report]=process.argv.slice(2);assert(input&&output&&materialDirectory&&['full','low'].includes(variant)&&report);const result=await applyFloorMaterial(input,output,materialDirectory,variant);await fs.writeFile(report,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result));
