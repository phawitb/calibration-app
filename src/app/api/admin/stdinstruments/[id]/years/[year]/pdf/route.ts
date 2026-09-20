import { pdfBytes } from '@/lib/pdfBytes'
import { NextRequest,NextResponse } from 'next/server'
import { standardYearActor,standardYearFailure } from '@/lib/standardYearHttp'
import { normalizeStandardYear,StandardYearError } from '@/lib/standardYears'
import { uploadStandardYearPdf } from '@/lib/standardYearService'
import StandardInstrumentYear from '@/models/StandardInstrumentYear'
import { inlineContentDisposition } from '@/lib/contentDisposition'
export async function GET(_req:NextRequest,{params}:{params:{id:string;year:string}}) {
  try {
    await standardYearActor()
    const v=await StandardInstrumentYear.findOne({instrumentRefId:params.id,year:normalizeStandardYear(params.year)}).sort({revision:-1}).select('+pdfData').lean() as any
    if(!v?.pdfData) throw new StandardYearError('ไม่พบ PDF',404)
    return new NextResponse(new Uint8Array(pdfBytes(v.pdfData)),{headers:{'Content-Type':'application/pdf','Content-Disposition':inlineContentDisposition(v.pdf.fileName),'Cache-Control':'private, no-store'}})
  }catch(e){return standardYearFailure(e)}
}
export async function POST(req:NextRequest,{params}:{params:{id:string;year:string}}) {
  try {const actor=await standardYearActor(); const form=await req.formData(); return NextResponse.json({data:await uploadStandardYearPdf(params.id,params.year,form.get('file') as File,form.get('expectedRevision'),actor,{certNo:form.get('certNo'),expiryDate:form.get('expiryDate')})})}catch(e){return standardYearFailure(e)}
}
