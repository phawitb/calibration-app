'use client'
import {createContext,useContext,useEffect,useState,type ReactNode} from 'react'
import {usePathname,useSearchParams} from 'next/navigation'
import {useSession} from 'next-auth/react'
import toast from 'react-hot-toast'
import {feedbackPageKey} from '@/lib/pageFeedback'
const Context=createContext({section:'',setSection:(_value:string)=>{}})
export function FeedbackProvider({children}:{children:ReactNode}){
 const [section,setSection]=useState('')
 return <Context.Provider value={{section,setSection}}>{children}</Context.Provider>
}
export function useFeedbackSection(section:string){
 const {setSection}=useContext(Context)
 useEffect(()=>{setSection(section);return()=>setSection('')},[section,setSection])
}
type Item={_id:string;text:string;authorName:string;createdAt:string}
export default function PageFeedback(){
 const pathname=usePathname();const params=useSearchParams();const {data:session}=useSession();const {section}=useContext(Context)
 const pageKey=feedbackPageKey(pathname,params.toString(),section,(session?.user as any)?.role)
 const [open,setOpen]=useState(false);const [items,setItems]=useState<Item[]>([]);const [drafts,setDrafts]=useState<Record<string,string>>({});const [loading,setLoading]=useState(false);const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [more,setMore]=useState(false);const [refresh,setRefresh]=useState(0)
 useEffect(()=>{setItems([]);setError('');try{setOpen(localStorage.getItem(`feedback-open:${pageKey}`)==='1')}catch{setOpen(false)}},[pageKey])
 useEffect(()=>{
  if(!open||!session)return
  const controller=new AbortController();setLoading(true);setItems([]);setError('')
  fetch(`/api/page-feedback?page=${encodeURIComponent(pageKey)}`,{signal:controller.signal}).then(async r=>{if(!r.ok)throw Error('โหลดความคิดเห็นไม่สำเร็จ');return r.json()}).then(data=>{if(!controller.signal.aborted){setItems(data.items);setMore(data.hasMore)}}).catch(e=>{if(!controller.signal.aborted)setError(e.message)}).finally(()=>{if(!controller.signal.aborted)setLoading(false)})
  return()=>controller.abort()
 },[pageKey,open,session,refresh])
 if(!session)return null
 const toggle=(value:boolean)=>{setOpen(value);try{localStorage.setItem(`feedback-open:${pageKey}`,value?'1':'0')}catch{}}
 const send=async()=>{
  const text=drafts[pageKey]||'';if(!text.trim()||saving)return
  setSaving(true)
  try{const r=await fetch('/api/page-feedback',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pageKey,text})});if(!r.ok)throw Error('บันทึกความคิดเห็นไม่สำเร็จ');setDrafts(d=>({...d,[pageKey]:''}));setRefresh(n=>n+1);toast.success('บันทึกความคิดเห็นแล้ว')}catch(e){toast.error((e as Error).message)}finally{setSaving(false)}
 }
 const remove=async(id:string)=>{if(!confirm('ลบความคิดเห็นนี้?'))return;try{const r=await fetch(`/api/page-feedback?id=${id}`,{method:'DELETE'});if(!r.ok)throw Error();setRefresh(n=>n+1)}catch{toast.error('ลบไม่สำเร็จ')}}
 const copy=async()=>{try{await navigator.clipboard.writeText(`ความคิดเห็นสำหรับพัฒนาระบบ\nหน้า: ${pageKey}\n\n`+items.map(i=>`${i.authorName} · ${new Date(i.createdAt).toLocaleString('th-TH')}\n${i.text}`).join('\n\n'));toast.success('คัดลอกแล้ว')}catch{toast.error('คัดลอกไม่ได้ กรุณาเลือกข้อความแล้วคัดลอก')}}
 return <>
  {!open&&<button onClick={()=>toggle(true)} className="fixed right-3 bottom-5 z-40 rounded-full bg-military-800 text-white shadow-lg px-4 py-3 text-sm" aria-expanded={false} aria-controls="page-feedback-panel">ความคิดเห็น</button>}
  {open&&<aside id="page-feedback-panel" aria-label="ความคิดเห็นของหน้านี้" className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white border-l shadow-xl flex flex-col xl:sticky xl:top-0 xl:h-screen xl:w-80 xl:shrink-0 xl:shadow-none">
   <header className="p-4 border-b"><div className="flex justify-between items-center"><h2 className="font-semibold text-military-900">ความคิดเห็นหน้านี้</h2><button className="btn-secondary !p-2 text-xs" onClick={()=>toggle(false)} aria-label="ปิดความคิดเห็น">ปิด ×</button></div><p className="text-xs text-gray-500 break-all mt-2">{pageKey}</p><p className="text-xs text-gray-500 mt-2">{(session.user as any)?.role==='admin'?'แสดงความคิดเห็นของผู้ใช้ทุกคน':'ข้อความของคุณส่งให้ผู้ดูแลเพื่อพัฒนาระบบ'}</p></header>
   <div className="p-4 border-b space-y-2"><label htmlFor="feedback-text" className="text-sm font-medium">อยากปรับแก้ตรงไหน?</label><p id="feedback-hint" className="rounded-lg bg-military-50 p-3 text-xs leading-relaxed text-military-800"><strong>เขียนได้เต็มที่ ยิ่งละเอียดยิ่งช่วยให้ปรับแก้ได้ตรงจุด</strong> บอกได้เลยว่าพบปัญหาตรงไหน อยากให้เปลี่ยนเป็นแบบใด พร้อมยกตัวอย่างประกอบได้ ไม่ต้องกังวลว่าข้อความจะยาวครับ</p><textarea id="feedback-text" aria-describedby="feedback-hint" className="input-field min-h-28 resize-y" placeholder="ระบุจุดที่พบปัญหา และสิ่งที่อยากให้ปรับ…" maxLength={3000} value={drafts[pageKey]||''} onChange={e=>setDrafts(d=>({...d,[pageKey]:e.target.value}))}/><div className="flex justify-between items-center"><span className="text-xs text-gray-400">{(drafts[pageKey]||'').length}/3000</span><button className="btn-primary text-sm" disabled={saving||!drafts[pageKey]?.trim()} onClick={send}>{saving?'กำลังบันทึก…':'ส่งความคิดเห็น'}</button></div></div>
   <div className="flex-1 overflow-y-auto p-4 space-y-3"><div className="flex justify-between items-center"><span className="text-sm text-gray-500">{items.length} ความคิดเห็น</span><button disabled={!items.length||loading} onClick={copy} className="text-xs text-military-700 underline disabled:opacity-40">คัดลอกทั้งหมด</button></div>{loading?<p className="text-sm text-gray-500">กำลังโหลด…</p>:error?<div role="alert" className="text-sm text-red-600">{error}<button onClick={()=>setRefresh(n=>n+1)} className="ml-2 underline">ลองใหม่</button></div>:!items.length?<p className="text-sm text-gray-400 py-8 text-center">ยังไม่มีความคิดเห็นสำหรับหน้านี้</p>:items.map(i=><article key={i._id} className="rounded-lg border p-3 bg-gray-50"><p className="text-sm font-medium">{i.authorName}</p><p className="text-xs text-gray-400 mt-1">{new Date(i.createdAt).toLocaleString('th-TH')}</p><p className="whitespace-pre-wrap break-words text-sm text-gray-700 mt-3">{i.text}</p><button onClick={()=>remove(i._id)} className="text-xs text-red-600 mt-3">ลบ</button></article>)}{more&&<p className="text-xs text-amber-700">แสดง 200 ความคิดเห็นล่าสุด</p>}</div>
  </aside>}
 </>
}
