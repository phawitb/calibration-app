import assert from 'node:assert/strict'
import test from 'node:test'
import { persistRecordStep } from '../src/lib/recordStep'

test('persisting a viewed step does not update the record timestamp', async () => {
  let received: unknown[] = []
  const model = {
    findByIdAndUpdate: async (...args: unknown[]) => {
      received = args
      return null
    },
  }

  await persistRecordStep(model, 'record-1', 'preview')

  assert.deepEqual(received, [
    'record-1',
    { lastStep: 'preview' },
    { timestamps: false },
  ])
})
