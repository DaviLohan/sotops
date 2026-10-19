# Certificado TLS

O proxy espera dois arquivos nesta pasta (que não é versionada):

- `fullchain.pem` — certificado e cadeia intermediária
- `privkey.pem` — chave privada

## Let's Encrypt (produção)

Com o DNS do domínio já apontando para o servidor e a pilha no ar, emita o certificado pelo
desafio HTTP servido em `/.well-known/acme-challenge/` (volume `acme-webroot`):

```bash
docker run --rm \
  -v efed_acme-webroot:/var/www/acme \
  -v "$PWD/infrastructure/nginx/letsencrypt:/etc/letsencrypt" \
  certbot/certbot certonly --webroot -w /var/www/acme -d SEU_DOMINIO --agree-tos -m SEU_EMAIL

cp infrastructure/nginx/letsencrypt/live/SEU_DOMINIO/fullchain.pem infrastructure/nginx/certs/
cp infrastructure/nginx/letsencrypt/live/SEU_DOMINIO/privkey.pem   infrastructure/nginx/certs/
docker compose exec proxy nginx -s reload
```

Na primeira subida o Nginx precisa de um certificado para iniciar: use o autoassinado abaixo e
substitua depois. A renovação automática está prevista para a Fase 6.

## Autoassinado (primeira subida ou teste local)

```bash
openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
  -keyout infrastructure/nginx/certs/privkey.pem \
  -out infrastructure/nginx/certs/fullchain.pem \
  -subj "/CN=localhost"
```
