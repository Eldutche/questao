# 📚 Questões de Concurso (PWA + Supabase)

App para **cadastrar e responder questões**, que funciona no **celular e no PC**.
É um PWA: um site que você "instala" na tela inicial. Sem loja de apps, sem compilar nada.

## Recursos
- Login (e-mail + senha) — cada pessoa vê só as próprias questões
- Adicionar / editar / excluir questões (5 alternativas, disciplina, banca, ano, comentário)
- Praticar: aleatória, só as que errou, ou ainda não respondidas; filtro por disciplina
- Estatísticas: aproveitamento geral e por disciplina
- Instalável e abre offline (o "esqueleto"; os dados precisam de internet)

## Passo 1 — Supabase (≈5 min)
1. Crie um projeto em https://supabase.com
2. Vá em **SQL Editor → New query**, cole o conteúdo de `supabase.sql` e clique **Run**
3. Vá em **Project Settings → API** e copie:
   - **Project URL**
   - **anon public key**
4. Cole os dois valores em `config.js`
5. (Opcional) Em **Authentication → Providers → Email**, desative "Confirm email" se quiser entrar logo após criar a conta

> A chave `anon` é pública por design. A segurança vem das regras RLS do `supabase.sql`.

## Passo 2 — Testar no PC
```bash
cd concursos-app
python3 -m http.server 8080
```
Abra http://localhost:8080 (o `localhost` é aceito para PWA).

## Passo 3 — Publicar (grátis, necessário para instalar no celular)
O celular só instala PWA via **HTTPS**. O jeito mais simples:
- **Netlify Drop**: acesse https://app.netlify.com/drop e arraste a pasta `concursos-app`. Pronto, você recebe um link `https://...netlify.app`.
- Alternativas: Cloudflare Pages, GitHub Pages ou Vercel.

## Passo 4 — Instalar
- **Android (Chrome):** abra o link → menu ⋮ → **Instalar app** / Adicionar à tela inicial
- **iPhone (Safari):** abra o link → Compartilhar → **Adicionar à Tela de Início**
- **PC (Chrome/Edge):** ícone de instalar na barra de endereço

## Estrutura
```
index.html  styles.css  app.js  config.js
manifest.webmanifest  sw.js  icons/
supabase.sql
```

## Quando mudar o app
Se alterar arquivos e o celular continuar mostrando a versão antiga, troque `CACHE = "questoes-v1"` em `sw.js` para `v2`.
