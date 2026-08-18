# Credenciais deste backend

**Não coloque `service-account.json` aqui.**

O `FirebaseConfig` usa `GoogleCredentials.getApplicationDefault()`, que lê a
variável de ambiente `GOOGLE_APPLICATION_CREDENTIALS` — o arquivo nunca foi
lido do classpath. O que ele fazia aqui era só ser empacotado dentro do fat
jar, em `BOOT-INF/classes/service-account.json`.

Isso é uma chave de administrador do Firebase: ela **ignora as regras do
Firestore**. Dentro do jar, ela viaja junto em qualquer deploy, e um jar é
muito mais fácil de copiar por aí do que um arquivo que alguém precisou
colocar no servidor de propósito.

Para rodar, aponte a variável para o arquivo que vive fora do repositório:

```powershell
$env:GOOGLE_APPLICATION_CREDENTIALS = "C:\engine-credentials\service-account.json"
java -jar target/engine-api-0.0.1-SNAPSHOT.jar
```

Removido em 18/08/2026.
