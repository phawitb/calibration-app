import {test} from 'node:test'
import assert from 'node:assert/strict'
import {feedbackPageKey,feedbackScope,validateFeedbackPage} from '../src/lib/pageFeedback'

test('separates pages, admin categories and record steps, ignores list filters',()=>{
 assert.equal(feedbackPageKey('/dashboard','order=abc'),'/dashboard')
 assert.equal(feedbackPageKey('/admin','tab=data'),'/admin?tab=data&category=units')
 assert.notEqual(feedbackPageKey('/admin','tab=data&category=units'),feedbackPageKey('/admin','tab=data&category=stdinstruments'))
 assert.notEqual(feedbackPageKey('/records/abc','','edit'),feedbackPageKey('/records/abc','','preview'))
 assert.equal(feedbackPageKey('/dashboard','','preview'),'/dashboard')
 assert.equal(feedbackPageKey('/admin','','','technician'),'/admin?tab=data&category=units')
})
test('only administrators can read or delete other authors comments',()=>{
 assert.deepEqual(feedbackScope({id:'a',role:'admin'}),{})
 for(const role of ['hospital_user','technician','approver',undefined]) assert.deepEqual(feedbackScope({id:'a',role}),{authorId:'a'})
})
test('rejects missing, external or malformed page keys',()=>{
 for(const value of [null,{},'https://example.com','//example.com','/a\nb','/a#b','/'+ 'x'.repeat(501)]) assert.throws(()=>validateFeedbackPage(value))
 assert.equal(validateFeedbackPage('/records/abc?section=preview'),'/records/abc?section=preview')
})
