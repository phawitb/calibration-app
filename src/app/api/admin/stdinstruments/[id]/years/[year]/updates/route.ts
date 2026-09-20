import { NextRequest,NextResponse } from 'next/server'
import { standardYearActor,standardYearFailure } from '@/lib/standardYearHttp'
import { previewStandardUpdates,applyStandardUpdate } from '@/lib/standardUpdateService'
export const maxDuration=60
export async function GET(_req:NextRequest,{params}:{params:{id:string;year:string}}) {
  try {await standardYearActor();return NextResponse.json(await previewStandardUpdates(params.id,params.year))}catch(e){return standardYearFailure(e)}
}
export async function POST(req:NextRequest,{params}:{params:{id:string;year:string}}) {
  try {const actor=await standardYearActor();return NextResponse.json(await applyStandardUpdate(params.id,params.year,await req.json(),actor))}catch(e){return standardYearFailure(e)}
}
