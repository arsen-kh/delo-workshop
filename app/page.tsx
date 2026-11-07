import Workspace from './workspace';
import { getChatGPTUser,chatGPTSignInPath } from './chatgpt-auth';
export const dynamic='force-dynamic';
export default async function Page(){const user=await getChatGPTUser();return user?<Workspace/>:<main className="welcome"><div className="brandmark">д.</div><span className="eyebrow">ДЕЛО / МАСТЕРСКАЯ</span><h1>Каждая заявка.<br/>На своём месте.</h1><p>Клиенты, сроки и работа команды — в одном спокойном пространстве.</p><a className="button primary" href={chatGPTSignInPath('/')} target="_top">Открыть мастерскую →</a><small>Личный учебный проект · Арсен Хутов</small></main>;}
