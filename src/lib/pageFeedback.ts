export function feedbackPageKey(path: string, query: string, section = '', role = '') {
  const params=new URLSearchParams(query)
  const suffix=new URLSearchParams()
  if(path==='/admin') {
    const tab=params.get('tab') || (role==='technician'?'data':'users'); suffix.set('tab',tab)
    if(tab==='data') suffix.set('category',params.get('category') || 'units')
  }
  if(section && /^\/records\/[^/]+$/.test(path) && path!=='/records/new') suffix.set('section',section)
  return path+(suffix.size?'?'+suffix.toString():'')
}
export function validateFeedbackPage(value: unknown): string {
  if(typeof value!=='string'||value.length>500||!value.startsWith('/')||value.startsWith('//')||/[\r\n#]/.test(value)) throw Error('ตำแหน่งหน้าไม่ถูกต้อง')
  return value
}
export function feedbackScope(user:{id:string;role?:string}) {
  return user.role==='admin' ? {} : {authorId:user.id}
}
