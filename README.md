# Shell Café Ponto V2

Sistema de ponto mais seguro com:

- Login por funcionário usando Supabase Auth
- Perfil de administrador
- Funcionário só vê seus próprios pontos
- Admin vê todos os pontos
- RLS no Supabase
- Registro de entrada, saída para intervalo, volta do intervalo e saída
- Geolocalização obrigatória
- Bloqueio por raio da loja
- Selfie obrigatória
- Upload da selfie no Supabase Storage
- Relatórios com filtro por período
- Exportação CSV
- Cadastro de funcionário pelo admin
- Painel simples para operação 24h

## 1. Criar projeto no Supabase

Crie um projeto no Supabase.

Depois vá em:

SQL Editor > New Query

Cole e execute o arquivo:

`supabase.sql`

## 2. Criar bucket para selfies

No Supabase:

Storage > New bucket

Nome:

`ponto-selfies`

Marque como **private**.

## 3. Configurar variáveis

Copie `.env.example` para `.env.local`.

```bash
cp .env.example .env.local
```

Preencha:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
NEXT_PUBLIC_STORE_LATITUDE=
NEXT_PUBLIC_STORE_LONGITUDE=
NEXT_PUBLIC_ALLOWED_RADIUS_METERS=120
NEXT_PUBLIC_STORE_NAME=Shell Café
```

Para pegar latitude e longitude da loja:

1. Abra Google Maps
2. Clique com botão direito na loja
3. Copie as coordenadas
4. Cole no `.env.local`

## 4. Rodar local

```bash
npm install
npm run dev
```

Acesse:

`http://localhost:3000`

## 5. Criar primeiro admin

No Supabase:

Authentication > Users > Add user

Crie seu usuário admin.

Depois vá no SQL Editor e rode:

```sql
insert into profiles (id, name, role, active)
values ('COLE_AQUI_O_ID_DO_USUARIO_AUTH', 'Diego', 'admin', true);
```

O ID fica em:

Authentication > Users > User UID

## 6. Criar funcionários

Entre no sistema com o admin.

Vá em:

Admin > Funcionários

Cadastre o funcionário.

Depois crie o login dele em:

Supabase > Authentication > Users > Add user

Use o mesmo e-mail cadastrado no sistema.

Depois vincule o usuário ao funcionário:

```sql
update profiles
set id = 'UID_DO_USUARIO_AUTH'
where email = 'email-do-funcionario@exemplo.com';
```

## 7. Publicar na Vercel

1. Suba esse projeto para o GitHub
2. Entre na Vercel
3. New Project
4. Import GitHub
5. Configure as mesmas variáveis do `.env.local`
6. Deploy

## Observações importantes

Essa V2 já é muito mais segura que a V1, mas para uso trabalhista oficial recomendo validar com contador/advogado trabalhista.

Para aumentar ainda mais a segurança, depois podemos adicionar:

- Reconhecimento facial
- Aprovação de ajustes de ponto
- Espelho de ponto mensal com assinatura digital
- Adicional noturno automático
- Banco de horas
- Escalas por funcionário
- Livro de ocorrências integrado
