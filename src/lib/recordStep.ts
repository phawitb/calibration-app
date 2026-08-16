interface RecordStepModel {
  findByIdAndUpdate(
    id: string,
    update: { lastStep: string },
    options: { timestamps: false },
  ): Promise<unknown>
}

export function persistRecordStep(model: RecordStepModel, recordId: string, step: string) {
  return model.findByIdAndUpdate(
    recordId,
    { lastStep: step },
    { timestamps: false },
  )
}
