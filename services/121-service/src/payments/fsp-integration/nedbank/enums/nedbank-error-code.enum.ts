// This is non-exhaustive enum of error codes that can be returned by Nedbank API
// It is used to identify the error code and use it for business logic in our code
// Since nedbank API is not documented, only the error codes that are specifically handled in our code are included
export enum NedbankErrorCode {
  NBApimResourceNotFound = 'NB.APIM.Resource.NotFound',
}
