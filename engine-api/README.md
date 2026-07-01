# Engine API

Backend Java/Spring Boot para o Engine.

## Requisitos

- Java 21
- Maven 3.9+ ou a copia local em `tools/apache-maven-3.9.16`

## Rodando localmente

O backend usa Firebase Admin para validar tokens e acessar o Firestore. Configure uma credencial de service account antes de subir:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS="C:\caminho\para\service-account.json"
$env:FIREBASE_PROJECT_ID="engine-garage"
```

Para imagem via Pexels:

```powershell
cd engine-api
$env:PEXELS_API_KEY="sua-chave"
mvn spring-boot:run
```

A API sobe em `http://localhost:8080`.

Swagger UI:

```txt
http://localhost:8080/swagger-ui/index.html
```

Especificacao OpenAPI em JSON:

```txt
http://localhost:8080/v3/api-docs
```

Na raiz do projeto tambem da para usar:

```powershell
npm run api:dev
npm run api:build
```

## Endpoints iniciais

- `GET /api/health`
- `GET /api/fipe/brands`
- `GET /api/fipe/brands/{brandId}/models`
- `GET /api/fipe/brands/{brandId}/models/{modelId}/years`
- `GET /api/fipe/brands/{brandId}/models/{modelId}/years/{yearId}/price`
- `GET /api/images/car?query=Ferrari`

## Frontend

No Vite, configure:

```powershell
$env:VITE_API_URL="http://localhost:8080/api"
npm run dev
```

Quando `VITE_API_URL` nao estiver configurado, o frontend continua usando Firebase/FIPE/Pexels diretamente como antes.
