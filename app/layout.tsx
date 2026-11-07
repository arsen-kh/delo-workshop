import type { Metadata } from 'next';
import './globals.css';
export const metadata:Metadata={title:'Дело — мастерская под контролем',description:'Заявки, сроки и отчёты небольшой ремонтной мастерской.'};
export default function Layout({children}:{children:React.ReactNode}){return <html lang="ru"><body>{children}</body></html>;}
