export const errorResponse = {
  type: 'object',
  required: ['error'],
  properties: {
    error: { type: 'string' }
  }
};

export const idParams = {
  type: 'object',
  required: ['id'],
  properties: {
    id: { type: 'integer', minimum: 1 }
  }
};
