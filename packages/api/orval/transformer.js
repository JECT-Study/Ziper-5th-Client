// 백엔드 스펙의 빈틈을 메운다. 백엔드가 고치면 해당 항목을 지운다.

const operationIds = {
  issue: 'issueEmailVerification',
  verify: 'verifyEmailCode',
  resend: 'resendEmailCode',
  status: 'getEmailVerificationStatus',
  signup: 'signupWithEmail',
  checkAvailability: 'checkNicknameAvailability',
};

// 스펙은 모두 200 으로 적는다.
const successStatus = {
  createTag: '201',
  createProductCard: '201',
  uploadImage: '201',
  createBoard: '201',
  signupWithOAuth: '201',
  issueEmailVerification: '201',
  signupWithEmail: '201',
  logout: '204',
  verifyEmailCode: '204',
  resendEmailCode: '204',
  deleteProductCard: '204',
  deleteBoard: '204',
  deleteTag: '204',
};

const fallbackIcons = ['TOP', 'PANTS', 'SKIRT', 'ACCESSORY', 'BEAUTY'];

const enums = {
  CreateProductCardRequest: { fallbackIcon: fallbackIcons, metadataSource: ['CLIENT', 'MANUAL'] },
  UpdateProductCardRequest: { fallbackIcon: fallbackIcons },
  ProductLinkReportRequest: { status: ['AVAILABLE', 'SOLD_OUT', 'REMOVED', 'UNKNOWN'] },
};

const required = {
  CreateBoardResponse: ['boardId', 'name', 'modifiable', 'productCount', 'createdAt'],
  UpdateBoardResponse: ['boardId', 'name'],
  ImageUploadResponse: ['fileId', 'url', 'contentType', 'fileSize'],
  OAuthLoginResponse: ['authType'],
  ProductLinkStatusResponse: ['status'],
};

const parameters = {
  getBoardProducts: { sort: { enum: ['RECENT', 'OLDEST', 'PRICE_ASC', 'PRICE_DESC'] } },
  loginWithOAuth: { provider: { enum: ['apple', 'naver', 'kakao'] } },
  loginWithOAuthCode: { provider: { enum: ['apple', 'naver', 'kakao'] } },
  checkNicknameAvailability: { nickname: { required: true } },
};

function withEnum(schema, values) {
  return Array.isArray(schema.type) && schema.type.includes('null')
    ? { ...schema, enum: [...values, null] }
    : { ...schema, enum: values };
}

/**
 * @param {import("openapi3-ts/oas31").OpenAPIObject} spec
 * @return {import("openapi3-ts/oas31").OpenAPIObject}
 */
export default (spec) => {
  spec.info = { ...spec.info, title: 'Ziper API' };
  const schemas = spec.components?.schemas ?? {};

  for (const [name, fields] of Object.entries(enums)) {
    for (const [field, values] of Object.entries(fields)) {
      const properties = schemas[name].properties;
      properties[field] = withEnum(properties[field], values);
    }
  }
  for (const [name, fields] of Object.entries(required)) {
    schemas[name].required = [...new Set([...(schemas[name].required ?? []), ...fields])];
  }

  for (const path of Object.values(spec.paths ?? {})) {
    for (const operation of Object.values(path)) {
      if (!operation?.operationId) continue;
      operation.operationId = operationIds[operation.operationId] ?? operation.operationId;
      const id = operation.operationId;

      for (const response of Object.values(operation.responses ?? {})) {
        if (response.content?.['*/*']) {
          response.content = { 'application/json': response.content['*/*'] };
        }
      }
      const status = successStatus[id];
      if (status && operation.responses?.['200']) {
        const ok = operation.responses['200'];
        delete operation.responses['200'];
        operation.responses[status] =
          status === '204' ? { description: 'No Content' } : { ...ok, description: 'Created' };
      }
      if (id === 'getExtractionRules') {
        operation.responses['304'] = { description: 'Not Modified' };
      }

      for (const parameter of operation.parameters ?? []) {
        const patch = parameters[id]?.[parameter.name];
        if (!patch) continue;
        if (patch.enum) parameter.schema = { ...parameter.schema, enum: patch.enum };
        if (patch.required) parameter.required = true;
      }
    }
  }
  return spec;
};
