# Cadernin — Organização Pessoal de Estudos

O **Cadernin** é um aplicativo web pessoal e 100% gratuito para organizar sua rotina de estudos, acompanhar matérias e subtópicos, registrar exercícios separando acertos reais de chutes, corrigir simulados (Modo Express e Modo Raio-X), visualizar sua evolução em gráficos e instalar no celular como um aplicativo nativo.

Este guia foi escrito de forma simples e direta para qualquer pessoa colocar sua própria cópia no ar, **mesmo sem saber programar**.

---

## O que você vai precisar (tudo gratuito)

1. Uma conta gratuita no **[GitHub](https://github.com)** (onde o código fica guardado).
2. Uma conta gratuita no **[Supabase](https://supabase.com)** (onde seus dados de estudo ficam salvos na nuvem).
3. Uma conta gratuita na **[Vercel](https://vercel.com)** (onde o site fica publicado na internet com seu link próprio).

---

## Passo 1 — Copiar o projeto para o seu GitHub

1. Faça login na sua conta do **GitHub**.
2. Abra a página deste repositório no GitHub.
3. No canto superior direito, clique no botão **Fork** e depois em **Create fork**.
   - Pronto! Agora você tem uma cópia particular do **Cadernin** na sua conta.

---

## Passo 2 — Criar o banco de dados no Supabase

1. Acesse [supabase.com](https://supabase.com) e clique em **Start your project** (você pode entrar usando sua conta do GitHub).
2. Clique em **New project**, dê um nome (ex: `cadernin`), crie uma senha para o banco, escolha a região mais próxima (ex: *South America — São Paulo*) e clique em **Create new project**.
3. Aguarde 1 ou 2 minutos até o projeto terminar de ser criado.
4. No menu lateral esquerdo do Supabase, clique em **SQL Editor** e depois em **New query**.
5. Abra o arquivo [`supabase/schema.sql`](./supabase/schema.sql) aqui no repositório, copie **todo** o conteúdo dele e cole no editor do Supabase.
6. Clique no botão verde **Run** (canto inferior direito).
   - Se aparecer `Success. No rows returned`, deu tudo certo! Todas as tabelas e o espaço das 2 imagens de perfil (`avatar.webp` e `header.webp`) foram criados.
7. Agora pegue suas 2 chaves de conexão:
   - No menu lateral esquerdo, clique em **Project Settings** (ícone de engrenagem lá embaixo) → **API** (ou **Data API / API Keys**).
   - Copie e guarde em um bloco de notas:
     1. **Project URL** (algo como `https://abcdefghijkl.supabase.co`)
     2. **anon / public key** (um código longo que começa com `eyJ...` ou `sb_publishable_...`)

---

## Passo 3 — Publicar grátis na Vercel

1. Acesse [vercel.com](https://vercel.com) e clique em **Sign Up** (entre usando a mesma conta do **GitHub**).
2. No painel inicial da Vercel, clique em **Add New…** → **Project**.
3. Encontre o repositório do **Cadernin** na lista e clique em **Import**.
4. Antes de clicar em Deploy, abra a seção **Environment Variables** (Variáveis de Ambiente) e adicione estas 2 chaves exatamente com esses nomes:
   - Nome: `NEXT_PUBLIC_SUPABASE_URL` → Valor: cole a **Project URL** do Passo 2.
   - Nome: `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Valor: cole a chave **anon / public** do Passo 2.
5. Clique em **Deploy** e aguarde cerca de 1 a 2 minutos.
6. Quando terminar, a Vercel vai mostrar o link do seu aplicativo (ex: `https://cadernin-seu-nome.vercel.app`). Já está no ar!

---

## Passo 4 — Instalar no celular como aplicativo (iOS e Android)

O Cadernin funciona em modo **PWA (tela cheia, sem barra do navegador)**:

### No iPhone / iPad (iOS)
1. Abra o link do seu Cadernin no navegador **Safari**.
2. Toque no botão **Compartilhar** (o quadrado com uma seta apontando para cima, na barra inferior).
3. Role para baixo e toque em **Adicionar à Tela de Início**.
4. Confirme o nome (**Cadernin**) e toque em **Adicionar**.

### No Android
1. Abra o link do seu Cadernin no navegador **Google Chrome**.
2. Toque nos **três pontinhos (`⋮`)** no canto superior direito.
3. Toque em **Instalar aplicativo** (ou **Adicionar à tela inicial**) e confirme.

---

## Primeiros passos dentro do Cadernin

- **Personalize seu espaço:** na tela **Início**, clique na capa, na foto de perfil ou no lápis ao lado do seu nome para personalizar. As imagens são comprimidas automaticamente no navegador para ocupar quase zero espaço no Supabase.
- **Mude o nome do app ou o tema:** em **Configurações → Perfil & Aparência**, você pode renomear o aplicativo, ajustar sua meta diária e alternar entre **Modo Claro** e **Modo Escuro**.
- **Carregue as 120 habilidades do ENEM em 1 clique:** vá em **Configurações → Matriz ENEM** e clique em **Carregar estrutura base ENEM (H1–H30 por área)**.
- **Monte suas matérias:** abra **Cronograma**, clique em **Nova matéria**, crie seus assuntos gerais e subtópicos opcionais.
- **Faça backup quando quiser:** em **Configurações → Backup JSON**, você pode baixar um único arquivo `.json` com todos os seus dados e restaurá-lo a qualquer momento.

---

## Rodar no seu computador (opcional)

Se quiser testar localmente no seu computador antes de publicar:

1. Instale o [Node.js](https://nodejs.org) (versão LTS).
2. Baixe o projeto e crie um arquivo chamado `.env.local` na pasta principal copiando o modelo de `.env.local.example` com suas 2 chaves do Supabase.
3. Abra o terminal na pasta do projeto e execute:

```bash
npm install
npm run dev
```

Depois, abra `http://localhost:3000` no navegador.
