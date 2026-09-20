import { NextRequest, NextResponse } from 'next/server'
import { standardYearActor,standardYearFailure } from '@/lib/standardYearHttp'
import { listStandardYears,saveStandardYear } from '@/lib/standardYearService'
export async function GET(_req:NextRequest,{params}:{params:{id:string}}) {
  try { await standardYearActor(); return NextResponse.json(await listStandardYears(params.id)) } catch(e) { return standardYearFailure(e) }
}
export async function POST(req:NextRequest,{params}:{params:{id:string}}) {
  try {
    const actor = await standardYearActor()
    let input, file: File | undefined
    if (req.headers.get('content-type')?.includes('multipart/form-data')) {
      const form = await req.formData()
      input = JSON.parse(String(form.get('data') || '{}'))
      const attachment = form.get('file')
      if (attachment && typeof attachment !== 'string') file = attachment
    } else input = await req.json()
    return NextResponse.json({ data: await saveStandardYear(params.id, input, actor, file) })
  } catch(e) { return standardYearFailure(e) }
}
