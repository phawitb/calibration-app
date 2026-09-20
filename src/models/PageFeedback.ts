import mongoose,{Schema} from 'mongoose'
const schema=new Schema({
 pageKey:{type:String,required:true,index:true},
 text:{type:String,required:true,maxlength:3000},
 authorId:{type:String,required:true,index:true},
 authorName:{type:String,required:true},
},{timestamps:true})
export default mongoose.models.PageFeedback || mongoose.model('PageFeedback',schema)
