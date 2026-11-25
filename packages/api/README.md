# 클라이언트 API 경계

## 상품 저장 (JEC-17)

`@ziper/api/product-save`는 웹이 사용할 인터페이스입니다. 서버의 요청 경로/형식이나 응답 코드를 뜻하지 않습니다.

서버 기본 브랜치 [develop @ 4b5c5ea](https://github.com/JECT-Study/Ziper-5th-Server/tree/4b5c5eae25e55db09f9856633ecaedd213fca85a) 및 공개 PR을 확인했습니다. 보드 엔티티와 리포지토리는 있으나 상품 추출·저장 및 보드 생성·조회 HTTP 계약은 발견되지 않았습니다. 운영 HTTP 어댑터는 계약이 확정될 때까지 연결하지 않습니다. [JEC-52](https://linear.app/ject5-team6/issue/JEC-52) 및 [JEC-57](https://linear.app/ject5-team6/issue/JEC-57)을 참고하세요.

연결 시 인증, 지원 도메인·리다이렉트 검사(서버에서 수행), 조회 실패와 미지원 구분, 다중 보드 등록, 업로드, 중복 요청 키와 결과가 불명인 요청의 처리 정책을 확인합니다. 서버 요청의 중복 방지 키는 HTTP 어댑터에서 관리합니다.

## 상품 상세·상태 관리 (JEC-23)

`@ziper/api/product-detail`은 클라이언트 인터페이스입니다. 웹 어댑터가 배포된 상세·수정·보드 조회·원본 이동 API의 응답을 이 인터페이스로 변환합니다. 구매 동작은 서버 배포 전까지 개발 프리뷰에만 제공됩니다. 계약과 검증 방법은 [JEC-23 문서](../../docs/jec-23-product-detail.md)를 참고하세요.
