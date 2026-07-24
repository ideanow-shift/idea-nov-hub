import {handleTalentWrite} from './http.ts';
import {createWriteRuntime} from './runtime-adapter.ts';
const runtime=createWriteRuntime(Deno.env,fetch);
Deno.serve(request=>handleTalentWrite(request,runtime));
