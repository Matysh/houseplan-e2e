// #1269 must start from a genuine legacy store, before plan-model.setup edits it.
import original from './playwright.config.mjs';
export default {...original,retries:0,testIgnore:['**/first-run/**','**/upgrade/**'],projects:[
 original.projects.find(project=>project.name==='setup'),
 {...original.projects.find(project=>project.name==='admin'),testMatch:/legacy\/stairs\.admin\.spec\.mjs$/,dependencies:['setup']},
]};
