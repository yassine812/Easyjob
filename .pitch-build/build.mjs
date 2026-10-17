import fs from 'node:fs/promises';
import path from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {Presentation,PresentationFile} from '@oai/artifact-tool';
const B=path.dirname(fileURLToPath(import.meta.url));
const ROOT='C:/Users/Yassine/job startup';
const OUT=path.join(ROOT,'output/pdf');
const SKILL='C:/Users/Yassine/.codex/plugins/cache/openai-primary-runtime/presentations/26.1009.11318/skills/presentations';
const PY='C:/Users/Yassine/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
const p=Presentation.create({slideSize:{width:1280,height:720}});
const C={bg:'#101727',white:'#F5F6FC',muted:'#BBC6DB',accent:'#A8B4FF',mint:'#9CE2CE'};
let no=0;
const layouts=[];
function text(s,str,x,y,w,h,size=26,color=C.muted,bold=false){
 layouts[no-1].push({kind:'text',text:str,x,y,w,h,size,color,bold});
 const sh=s.shapes.add({geometry:'textbox',name:'Text '+str.slice(0,45),position:{left:x,top:y,width:w,height:h},fill:'none',line:{fill:'none',width:0}});
 sh.text=str;sh.text.style={typeface:'Arial',fontSize:size,color,bold,verticalAlignment:'top',insets:0,autoFit:'none'};return sh;
}
function slide(title,sub=''){
 const s=p.slides.add();s.background.fill=C.bg;no++;layouts.push([]);
 text(s,'EasyJob',64,30,250,32,22,C.accent,true);
 if(title)text(s,title,64,89,1150,106,46,C.white,true);
 if(sub)text(s,sub,66,174,1130,64,24,C.muted);
 text(s,String(no).padStart(2,'0'),1155,669,60,26,18,C.muted);
 s.speakerNotes.text='Projet EasyJob. Informations issues de la présentation du porteur et de la démonstration fournie. Les pistes commerciales et la feuille de route sont des intentions, pas des résultats acquis.';
 return s;
}
async function img(s,name,x,y,w,h,other=null){const fp=other||path.join(B,'assets',name+'.png');layouts[no-1].push({kind:'image',path:fp,x,y,w,h});const buf=await fs.readFile(fp);s.images.add({blob:buf.buffer.slice(buf.byteOffset,buf.byteOffset+buf.byteLength),contentType:other?'image/jpeg':'image/png',alt:name,fit:'contain',position:{left:x,top:y,width:w,height:h}});}
function item(s,title,body,x,y,w=500){text(s,title,x,y,w,42,29,C.white,true);text(s,body,x,y+52,w,106,26,C.muted);}
function note(s,txt){text(s,txt,64,622,1110,36,17,C.muted);}

// 01: cover
{
const s=slide('');text(s,'EasyJob',64,156,650,108,88,C.white,true);
text(s,'Le recrutement assisté\npar l’intelligence artificielle',68,289,540,145,42,C.accent,true);
text(s,'Candidats et recruteurs\ndans une même plateforme',68,463,510,86,29);
text(s,'Candidature au Label Startup\nTunisie, octobre 2026',68,589,560,61,22);
await img(s,'cover',654,239,564,318);
}
// 02
{
const s=slide('Le problème','Un parcours encore dispersé entre plusieurs outils.');
item(s,'Pour les candidats','Préparer le CV, consulter les offres et suivre les réponses demandent des démarches séparées.',64,281,500);
item(s,'Pour les entreprises','Les dossiers, les échanges et les entretiens se répartissent entre plusieurs supports.',676,281,500);
text(s,'Besoin commun : retrouver le contexte et la prochaine action au même endroit.',64,535,1100,83,31,C.accent,true);
}
// 03
{
const s=slide('Une plateforme, deux parcours','EasyJob relie la préparation du candidat au suivi du recrutement.');
text(s,'CANDIDAT',64,273,500,35,24,C.accent,true);
text(s,'CV et profil\nRecherche d’offres\nCandidatures et préparation',64,338,515,208,34,C.white);
text(s,'RECRUTEUR',682,273,500,35,24,C.mint,true);
text(s,'Publication des offres\nAnalyse des dossiers\nSuivi et entretiens',682,338,510,208,34,C.white);
note(s,'Interface disponible en français, anglais et arabe.');
}
// 04
{
const s=slide('Le parcours candidat');
item(s,'Trouver une offre','Rechercher un poste et voir les correspondances avec le profil.',64,256,328);
item(s,'Garder le suivi','Retrouver les candidatures et préparer les entretiens.',64,459,328);
await img(s,'candidate',440,209,776,402);note(s,'Capture du produit. Les comptes et les offres affichés servent à la démonstration.');
}
// 05
{
const s=slide('L’espace recruteur');
item(s,'Organiser le travail','Publier des offres et retrouver les candidatures dans un espace dédié.',64,256,328);
item(s,'Suivre les dossiers','Consulter les profils, suivre les étapes et planifier les entretiens.',64,459,328);
await img(s,'recruiter',440,209,776,402);note(s,'Capture du produit avec des données de démonstration.');
}
// 06
{
const s=slide('Un matching explicable');
item(s,'Lire la correspondance','Une analyse présente les compétences communes et les points à approfondir.',64,245,340);
item(s,'La décision humaine','L’IA accompagne l’analyse. Le recruteur décide de la suite.',64,460,340);
await img(s,'matching',452,220,764,387);note(s,'Les scores visibles illustrent une démonstration, pas une mesure de performance du modèle.');
}
// 07
{
const s=slide('Le marché de départ : la Tunisie');
text(s,'Startups et PME',64,264,520,54,42,C.accent,true);
text(s,'Des entreprises qui souhaitent structurer leurs recrutements avec un outil accessible.',64,344,506,146,30);
text(s,'Candidats',684,264,480,54,42,C.mint,true);
text(s,'Des personnes qui recherchent un emploi et veulent mieux préparer et suivre leurs démarches.',684,344,510,146,30);
text(s,'Expansion envisagée au Maghreb après validation des usages en Tunisie.',64,562,1110,76,28,C.white,true);
}
// 08
{
const s=slide('Le positionnement concurrentiel');
text(s,'Des acteurs déjà présents',64,242,590,42,30,C.white,true);
text(s,'Keejob et Tanitjobs\nOffres d’emploi et services aux recruteurs.',64,319,560,108,28);
text(s,'LinkedIn Recruiter\nRecherche de profils et prise de contact.',64,471,560,108,28);
text(s,'L’angle EasyJob',708,242,508,42,30,C.accent,true);
text(s,'Associer l’accompagnement du candidat, le suivi du recrutement et l’analyse explicable dans une expérience multilingue.',708,319,477,237,32,C.white);
note(s,'Positionnement visé. La différenciation devra se confirmer auprès des utilisateurs.');
text(s,'Sources : keejob.com/recruiter/ ; tanitjobs.com ; LinkedIn Talent Solutions',64,665,1080,22,14,C.muted);
s.speakerNotes.text='Sources officielles consultées le 11 octobre 2026 : https://www.keejob.com/recruiter/ ; https://www.tanitjobs.com/ ; https://business.linkedin.com/content/dam/me/business/en-us/talent-solutions-lodestone/body/pdf/RecruiterDataSheet-LI.pdf . Description générale, sans comparaison exhaustive des fonctionnalités. Le positionnement EasyJob est une intention stratégique.';
}
// 09
{
const s=slide('Le modèle économique envisagé','Un accès gratuit aux fonctions essentielles et des abonnements avancés.');
item(s,'Candidats','Un abonnement pour les fonctions d’accompagnement et de préparation avancées.',64,288,507);
item(s,'Entreprises','Un abonnement pour les besoins de recrutement et de gestion plus étendus.',680,288,500);
text(s,'La prochaine validation : identifier les usages récurrents et la disposition à payer.',64,537,1120,94,32,C.accent,true);
}
// 10
{
const s=slide('L’acquisition des premiers utilisateurs','Actions envisagées pour lancer les premiers tests en Tunisie.');
item(s,'Entreprises pilotes','Prospection directe de startups et PME. Démonstrations centrées sur un recrutement concret.',64,285,500);
item(s,'Communautés de candidats','Prise de contact avec des communautés étudiantes et professionnelles. Contenus utiles sur le CV et l’entretien.',681,285,500);
text(s,'Une boucle courte : tester le parcours, recueillir les retours, améliorer le produit.',64,548,1100,82,30,C.accent,true);
}
// 11
{
const s=slide('L’avancement du projet');
text(s,'MVP démontrable',64,243,595,62,47,C.accent,true);
text(s,'Les espaces candidat et recruteur sont accessibles dans la démonstration du produit.',64,340,537,123,30,C.white);
text(s,'Prochaine étape\nValider l’utilisation régulière et le passage à une offre payante.',64,506,538,108,26);
await img(s,'interview',650,235,566,319);
note(s,'Priorités : fiabilité des parcours, retours d’usage et qualité des analyses.');
}
// 12
{
const s=slide('La feuille de route sur trois ans','Trajectoire envisagée, à ajuster selon les retours et les ressources disponibles.');
const cols=[64,477,890];
const blocks=[['Année 1','Valider en Tunisie','Fiabiliser le MVP. Organiser les tests utilisateurs et les premiers essais payants.'],['Année 2','Développer l’adoption','Améliorer la fidélisation et reproduire les canaux d’acquisition qui fonctionnent.'],['Année 3','Évaluer l’expansion','Tester un autre marché du Maghreb si l’usage et le modèle économique le justifient.']];
blocks.forEach((b,i)=>{text(s,b[0],cols[i],269,320,50,34,C.accent,true);text(s,b[1],cols[i],346,330,84,30,C.white,true);text(s,b[2],cols[i],445,325,155,26);});
note(s,'Indicateurs : utilisateurs actifs, entreprises actives, rétention et abonnements payants.');
}
// 13
{
const s=slide('Le porteur du projet');
text(s,'Yassine',64,253,640,69,54,C.accent,true);
text(s,'Porteur d’EasyJob',66,348,615,48,34,C.white,true);
text(s,'Vision du produit et conduite du projet.',66,424,590,87,28);
text(s,'Renforts envisagés\nExpertise en recrutement et développement commercial.',66,530,600,104,26);
await img(s,'Portrait de Yassine',813,225,380,380,'C:/Users/Yassine/Downloads/profile.jpg');
}
// 14
{
const s=slide('Les prochaines étapes');
text(s,'Rendre la recherche d’emploi plus claire\net le recrutement plus simple.',64,248,1140,143,48,C.white,true);
text(s,'Nous recherchons un accompagnement pour consolider le produit et préparer les premières validations commerciales.',64,436,1020,111,31);
text(s,'Priorités d’accompagnement : expertise RH, accès à des entreprises pilotes et développement commercial.',64,580,1090,64,24,C.accent);
}
await fs.mkdir(OUT,{recursive:true});
for(let i=0;i<p.slides.items.length;i++){
 const s=p.slides.items[i];const png=await p.export({slide:s,format:'png',scale:1});
 await fs.writeFile(path.join(B,'renders',`slide-${String(i+1).padStart(2,'0')}.png`),new Uint8Array(await png.arrayBuffer()));
 console.log('Rendered',i+1);
}
await fs.writeFile(path.join(B,'layout.json'),JSON.stringify(layouts,null,2));
await(await PresentationFile.exportPptx(p)).save(path.join(B,'candidate.pptx'));
const {finalizePresentation}=await import(pathToFileURL(path.join(SKILL,'container_tools/artifact_tool_utils.mjs')).href);
const result=await finalizePresentation({workspaceDir:ROOT,candidatePath:path.join(B,'candidate.pptx'),finalPath:path.join(OUT,'EasyJob-Pitch-Deck-FR-v2.pptx'),pythonExecutable:PY,integrityValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_package_integrity.py'),layoutValidatorPath:path.join(SKILL,'container_tools/inspect_presentation_layout_geometry.py'),layoutArgs:['--expected-slide-size-emu','12192000,6858000','--validate-bullet-geometry','--validate-heading-fit'],fontPolicy:{basis:'design',families:['Arial']},verifyArtifactToolImport:true,receiptPath:path.join(B,'validation-v2.json')});
console.log('DONE',JSON.stringify(result));
