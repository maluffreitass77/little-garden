# 🐰 Little Garden – Aventura no Jardim

Jogo 2D de sobrevivência com estética kawaii, feito para o projeto **Desafio da Sobrevivência**.

## Descrição e objetivo

Você controla um coelhinho que explora um jardim encantado. O objetivo é **sobreviver o máximo possível**, coletando flores, morangos e estrelinhas para fazer a maior pontuação, enquanto foge de abelhinhas, joaninhas e lagartas. O jogo termina quando as 3 vidas acabam, e o melhor resultado fica salvo como recorde.

## Regras

- Você começa com **3 vidas**.
- Encostar em um inimigo tira **1 vida**. Depois do tombo, o coelhinho fica **invulnerável por 1,6 s** (e pisca), então não perde várias vidas de uma vez.
- Itens e pontos: 🌸 flor = 10 · 🍓 morango = 15 · ⭐ estrela = 25. Quando um item é coletado, outro aparece em lugar aleatório dentro da área.
- A 🌺 flor especial dá proteção contra inimigos por 6 s.
- A cada **15 s** o **nível** sobe: inimigos mais rápidos e surgindo com mais frequência, e novos tipos aparecem (joaninhas no nível 2, lagartas no nível 3).
- A cada **30 s** o jardim muda de **fase** (manhã, tarde, entardecer e noite).
- Perdeu todas as vidas? É Game Over. O recorde só é atualizado se você superá-lo.

## Controles

| Ação | Teclado | Celular |
|---|---|---|
| Mover | W A S D ou setas | Botões ▲ ◀ ▼ ▶ na tela |
| Pausar / continuar | P ou ESC | Botão ⏸ |
| Ligar / desligar som | Botão 🔊 | Botão 🔊 |

## Como executar

1. Baixe a pasta completa do projeto.
2. Dê dois cliques em `index.html` (abre no navegador).
3. Não precisa de servidor nem de instalação. As fontes vêm do Google Fonts; sem internet, o jogo usa fontes do sistema.

## Funcionalidades obrigatórias

- Coelhinho controlável (WASD e setas), com limites da área e movimento fluido.
- Inimigos com 3 comportamentos: abelhas (movimento aleatório), joaninhas (perseguem o jogador) e lagartas (linha reta de um lado ao outro). Surgem em posições aleatórias.
- Colisões com perda de vida e intervalo de invulnerabilidade.
- Pontuação, vidas, temporizador e nível de dificuldade visíveis no topo.
- Dificuldade progressiva (velocidade, frequência de surgimento e novos inimigos).
- Estados: menu, jogando, pausa, Game Over e reinício completo (só o recorde é mantido).
- Recorde salvo em **LocalStorage**, mostrado no menu e no Game Over.
- Telas: inicial, jogo, pausa e Game Over.
- Controles por toque e layout responsivo.

## Funcionalidades extras

1. **Power-up de proteção:** a flor especial 🌺 aparece a cada 20 s (primeira aos 12 s) e some depois de 10 s se não for pega. Ao coletá-la, o coelhinho fica protegido por 6 s, com uma bolha dourada e contagem regressiva no topo.
2. **Sistema de conquistas:** *Florista* (10 flores), *Estrelinha* (100 pontos), *Sobrevivente* (60 s) e *Protegido* (usar a flor de proteção). Cada uma mostra uma notificação ao ser desbloqueada, e o Game Over lista as conquistas da partida.
3. **Sistema de fases:** a cada 30 s o jardim avança de fase, mudando gradualmente as cores do céu e das colinas e os enfeites (flores, borboletas, cogumelos, lua e estrelas piscando à noite). Um aviso aparece na troca.
4. **Efeitos sonoros:** sons suaves gerados com a Web Audio API para coleta, estrela, power-up, colisão, conquista, mudança de fase e Game Over. O botão 🔊 liga e desliga, e a escolha fica salva.

## Tecnologias utilizadas

HTML5, CSS3 e JavaScript puro (Canvas 2D, `requestAnimationFrame`, Web Audio API e LocalStorage). Nenhum framework ou biblioteca.

## Organização dos arquivos

```
little-garden/
├── index.html   # estrutura da página, HUD e telas
├── style.css    # visual kawaii, responsividade e animações
├── script.js    # lógica do jogo (loop, inimigos, colisões, pontuação, extras)
└── README.md    # este arquivo
```

## Como o recorde é salvo (para a apresentação)

O recorde fica na chave `littleGarden.highScore` do LocalStorage. Ao abrir o jogo, `loadHighScore()` lê o valor; no Game Over, `saveHighScore()` grava somente se a nova pontuação for maior.
