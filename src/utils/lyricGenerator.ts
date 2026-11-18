export function generateAutomaticLyrics(title: string, artist: string, style?: string): string {
  const cleanTitle = title || 'Composição Original';
  const cleanArtist = artist || 'Artista da Rádio';
  const cleanStyle = style || 'Art-Rock Contemporâneo & Harmonia Complexa';

  return `[Intro]
(Arranjo polirrítmico com sintetizadores modulares analógicos, Mellotron e violão aveludado)
O sinal de ${cleanArtist} sintoniza nas frequências da Beto's Radio.

[Verse 1]
Sob as luzes de néon e silício
Calculamos a órbita do nosso olhar
A entropia tenta ditar o início
Mas escolhemos o tempo desacelerar
${cleanTitle} ressoa na mente
Entre sinapses e ondas de café
O mundo lá fora corre impaciente
Mas aqui dentro o silêncio é fé.

[Pre-Chorus]
E cada acorde dissolve a distância
Uma física quântica feita de afeto
Onde o cálculo perde a ganância
E o teorema do amor é perfeito.

[Chorus]
Cantamos nas ondas de rádio e modulação
O eco eterno de ${cleanTitle}
Um compasso exato no coração
Entre o analógico e o infinito
Se a gravidade puxa pro chão
Nossa frequência vence o limite.

[Verse 2]
Arquitetura de acordes e poesia
Construída com esmero e fervor
Estilo: ${cleanStyle}
Transformando a angústia em harmonia
As frequências cruzam a cidade
Lembrando que o tempo é um véu
Onde a pura e sincera amizade
Virou constelação no céu.

[Bridge]
(Solo instrumental com delay analógico e crescendo orquestral)
Tudo se conecta, tudo se transforma
O som é a matéria que não se deforma!

[Chorus]
Cantamos nas ondas de rádio e modulação
O eco eterno de ${cleanTitle}
Um compasso exato no coração
Entre o analógico e o infinito
Se a gravidade puxa pro chão
Nossa frequência vence o limite.

[Outro]
(Fades out suavemente com acordes de Rhodes e chiado acolhedor de vinil)
Transmissão estelar em andamento... 
Beto's Radio • Inteligência e Arte em Frequência Modulada.`;
}
