import {analyze} from './model.js';
self.onmessage=({data})=>{try{const result=analyze(data.plan,data.config,progress=>self.postMessage({progress}));self.postMessage({result});}catch(error){self.postMessage({error:error.message});}};
