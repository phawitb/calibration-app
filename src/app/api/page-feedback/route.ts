import {NextRequest,NextResponse} from 'next/server'
import {getServerSession} from 'next-auth'
import {authOptions} from '@/lib/auth'
import {connectDB} from '@/lib/mongodb'
import PageFeedback from '@/models/PageFeedback'
import {feedbackScope,validateFeedbackPage} from '@/lib/pageFeedback'
import mongoose from 'mongoose'
async function actor(){ const s=await getServerSession(authOptions); return s?.user as {id:string;role?:string;name?:string;fullName?:string}|undefined }
export async function GET(req:NextRequest){
 const user=await actor();if(!user?.id)return NextResponse.json({error:'Unauthorized'},{status:401})
 let pageKey;try{pageKey=validateFeedbackPage(req.nextUrl.searchParams.get('page'))}catch{return NextResponse.json({error:'ตำแหน่งหน้าไม่ถูกต้อง'},{status:400})}
 await connectDB()
 const rows=await PageFeedback.find({pageKey,...feedbackScope(user)}).sort({createdAt:-1}).limit(201).lean()
 return NextResponse.json({items:rows.slice(0,200),hasMore:rows.length>200})
}
export async function POST(req:NextRequest){
 const user=await actor();if(!user?.id)return NextResponse.json({error:'Unauthorized'},{status:401})
 let body;try{body=await req.json();body.pageKey=validateFeedbackPage(body.pageKey);if(typeof body.text!=='string'||!body.text.trim()||body.text.trim().length>3000)throw Error()}catch{return NextResponse.json({error:'กรุณากรอกความคิดเห็นไม่เกิน 3,000 ตัวอักษร'},{status:400})}
 await connectDB()
 const item=await PageFeedback.create({pageKey:body.pageKey,text:body.text.trim(),authorId:user.id,authorName:user.fullName||user.name||'ผู้ใช้'})
 return NextResponse.json({item},{status:201})
}
export async function DELETE(req:NextRequest){
 const user=await actor();if(!user?.id)return NextResponse.json({error:'Unauthorized'},{status:401})
 const id=req.nextUrl.searchParams.get('id');if(!id||!mongoose.isValidObjectId(id))return NextResponse.json({error:'รายการไม่ถูกต้อง'},{status:400})
 await connectDB();const result=await PageFeedback.deleteOne({_id:id,...feedbackScope(user)})
 return NextResponse.json({deleted:result.deletedCount===1},{status:result.deletedCount?200:404})
}
