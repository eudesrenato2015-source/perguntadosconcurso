# Rota 190 PWA offline-first

Aplicativo estilo Estudei/QConcursos/Gran Questões: gamificado, estável e 100% offline (com modo online opcional).

## O que já está pronto
- Arena, Biblioteca, Revisão (SM-2), Dashboard e Campanha.
- Duelo Fantasma + Duelo Online opcional (Supabase Realtime).
- Gamificação: XP, níveis, streak e conquistas.
- Loja cosmética (temas por XP).
- Importador de PDF/Texto (gera packs offline).
- Question Packs (inclui ALEGO Policial Legislativo FGV).

## Rodar local (VSCode)
1) Abra o terminal integrado do VSCode.
2) Rode:
```bash
npm install
npm run dev
```
3) Abra a URL exibida no terminal (normalmente http://localhost:5173).

## Build / Preview
```bash
npm run build
npm run preview
```

## Duelo online (sem custo)
1) Crie um projeto gratuito no Supabase.
2) Copie **Project URL** e **Anon Key** (Settings > API).
3) Crie um `.env` com base no `.env.example` e preencha:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
4) Rode `npm run dev`.
5) Abra **Duelo**, escolha o **Modo** (Misto ou Foco) e gire a roleta.
6) Clique em **Criar sala** e envie o código para seu amigo.
7) Seu amigo abre **Duelo**, cola o código e clica **Entrar**.

Dica local: para jogar no celular na mesma rede, rode `npm run dev -- --host` e acesse pelo IP local.

## Deploy no Vercel (sem custo)
1) Crie uma conta no Vercel.
2) Importe o repositório do projeto.
3) Configure:
   - Framework: **Vite**
   - Build Command: `npm run build`
   - Output Directory: `dist`
4) (Opcional) Se quiser Duelo Online, adicione as env vars:
```
VITE_SUPABASE_URL=...
VITE_SUPABASE_ANON_KEY=...
```
5) Clique em **Deploy**.
6) Compartilhe a URL gerada com seu amigo.
7) Ambos abrem a URL no celular > **Duelo** > **Criar sala** / **Entrar** com o mesmo código.

## Importador de PDFs / Textos
- Acesse **Perfil > Importar conteúdos** ou a rota `/importar`.
- Suba um PDF ou cole o texto.
- Extraia tópicos e gere questões offline.
- O pack fica salvo localmente e pode ser ativado/desativado no Perfil.

## Question Packs
- Ative/desative packs em **Perfil**.
- Packs ficam em `src/data/packs/*.ts`.
- A seleção afeta Arena, Biblioteca e Duelo.

## Banco de questões (seed)
- Geração determinística com 600 questões.
- Ajuste em `src/data/seedQuestions.ts` caso queira mudar volume, temas ou textos.

## PWA
- Manifest + Service Worker via `vite-plugin-pwa`.
- Atualizações sinalizadas com toast.
