// Données pédagogiques des niveaux de challenge
// Structure : CHAPTERS > levels > verify(type, truthTable ou steps)
//
// Progression : on part de la porte NAND (universelle), on reconstruit les
// portes de base, puis on bâtit l'arithmétique (demi-additionneur, additionneur
// complet, additionneur N bits), avant d'aborder les briques d'un processeur
// (registres, compteur/PC, banque de registres). Le chapitre « Pour aller plus
// loin » regroupe des circuits combinatoires classiques (mux, décodeur,
// comparateur) hors du chemin principal.
//
// Chaque niveau a :
//   - objective : le but en une phrase (avec les termes définis pour un débutant)
//   - steps     : la marche à suivre, étape par étape (affichée numérotée)
// Appariement entrées/sorties : la vérification associe les INPUT et OUTPUT
// du circuit de l'élève PAR ORDRE DE CRÉATION (les labels sont ignorés). Les
// étapes précisent donc toujours l'ordre dans lequel créer les ports.
//
// Rappels de manipulation référencés par les étapes :
//   • Placer : cliquer le composant dans la palette de gauche, puis cliquer la grille.
//   • Renommer une entrée/sortie : la sélectionner, puis champ « Étiquette » (Propriétés).
//   • Régler une largeur de bus : la sélectionner, puis « Largeur (bits) » (Propriétés).
//   • Câbler : cliquer le port de SORTIE (à droite d'un composant), puis le port
//     d'ENTRÉE (à gauche) de la destination.

export const CHAPTERS = [
  {
    id: 'portes',
    title: 'Portes logiques',
    levels: [
      {
        id: 'nand-not',
        title: 'NOT avec un NAND',
        objective:
          'Fabriquer une porte NOT (qui inverse : 0 → 1 et 1 → 0) en n\'utilisant qu\'une seule porte NAND.',
        steps: [
          'Place une Entrée et renomme-la « A ».',
          'Place une porte NAND.',
          'Place une Sortie et renomme-la « S ».',
          'Relie « A » aux DEUX entrées du NAND (un câble vers chaque entrée).',
          'Relie la sortie du NAND à l\'entrée de « S ».',
          'Clique « Vérifier ». Astuce : un NAND qui reçoit deux fois le même signal renvoie son inverse.',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'NAND'],
        inputs: [{ name: 'A', width: 1 }],
        outputs: [{ name: 'S', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0], [1]],
          [[1], [0]],
        ],
      },
      {
        id: 'nand-and',
        title: 'AND avec 2 NAND',
        objective:
          'Fabriquer une porte AND (ET : la sortie vaut 1 seulement si A = 1 ET B = 1) à partir de 2 portes NAND.',
        steps: [
          'Crée l\'Entrée « A », puis l\'Entrée « B » (l\'ordre compte pour la vérification).',
          'Place une Sortie « S ».',
          'Place un 1er NAND et relie-lui A et B.',
          'Place un 2e NAND monté en NOT : relie la sortie du 1er NAND à ses DEUX entrées.',
          'Relie la sortie du 2e NAND à « S », puis clique « Vérifier ».',
          'Idée : NAND = AND inversé ; en inversant à nouveau (2e NAND en NOT) on retrouve le AND.',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'NAND'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [{ name: 'S', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0], [0]],
          [[0, 1], [0]],
          [[1, 0], [0]],
          [[1, 1], [1]],
        ],
      },
      {
        id: 'nand-or',
        title: 'OR avec 3 NAND',
        objective:
          'Fabriquer une porte OR (OU : la sortie vaut 1 si A = 1 OU B = 1) à partir de 3 portes NAND (loi de De Morgan).',
        steps: [
          'Crée l\'Entrée « A », puis l\'Entrée « B », et une Sortie « S ».',
          'Inverse A : place un NAND et relie A à ses deux entrées (= NON A).',
          'Inverse B de la même façon avec un 2e NAND (= NON B).',
          'Place un 3e NAND et relie-lui NON A et NON B.',
          'Relie la sortie du 3e NAND à « S », puis clique « Vérifier ».',
          'Idée (De Morgan) : A OU B = NON( NON A ET NON B ).',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'NAND'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [{ name: 'S', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0], [0]],
          [[0, 1], [1]],
          [[1, 0], [1]],
          [[1, 1], [1]],
        ],
      },
      {
        id: 'nand-xor',
        title: 'XOR avec 4 NAND',
        objective:
          'Fabriquer une porte XOR (OU exclusif : la sortie vaut 1 si A et B sont DIFFÉRENTS) avec 4 portes NAND.',
        steps: [
          'Crée l\'Entrée « A », l\'Entrée « B », et une Sortie « S ».',
          'NAND n°1 : relie A et B. Appelle son résultat « N ».',
          'NAND n°2 : relie A et N.',
          'NAND n°3 : relie B et N.',
          'NAND n°4 : relie les sorties des NAND n°2 et n°3.',
          'Relie la sortie du NAND n°4 à « S », puis clique « Vérifier ».',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'NAND'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [{ name: 'S', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0], [0]],
          [[0, 1], [1]],
          [[1, 0], [1]],
          [[1, 1], [0]],
        ],
      },
    ],
  },

  {
    id: 'arithmetique',
    title: 'Arithmétique',
    levels: [
      {
        id: 'half-adder',
        title: 'Demi-additionneur',
        objective:
          'Fabriquer un demi-additionneur : il additionne 2 bits A et B, et donne la somme S et la retenue C.',
        steps: [
          'Crée l\'Entrée « A », puis l\'Entrée « B ».',
          'Crée la Sortie « S » (la somme), puis la Sortie « C » (la retenue) — dans cet ordre.',
          'Somme : place une porte XOR, relie-lui A et B, puis relie sa sortie à « S ».',
          'Retenue : place une porte AND, relie-lui A et B, puis relie sa sortie à « C ».',
          'Clique « Vérifier ». Rappel : S = A XOR B (1 si différents), C = A AND B (1 si les deux valent 1).',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [{ name: 'S', width: 1 }, { name: 'C', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0], [0, 0]],
          [[0, 1], [1, 0]],
          [[1, 0], [1, 0]],
          [[1, 1], [0, 1]],
        ],
      },
      {
        id: 'full-adder',
        title: 'Additionneur complet',
        objective:
          'Fabriquer un additionneur complet : il additionne A, B et une retenue entrante Cin, et donne la somme S et la retenue sortante Cout. C\'est la brique de base pour additionner plusieurs bits.',
        steps: [
          'Crée les Entrées dans l\'ordre : « A », « B », « Cin ».',
          'Crée les Sorties dans l\'ordre : « S », « Cout ».',
          'Somme : S = A XOR B XOR Cin. Enchaîne deux XOR (d\'abord A XOR B, puis ce résultat XOR Cin) et relie à « S ».',
          'Retenue : Cout = (A AND B) OU (Cin AND (A XOR B)). Utilise deux AND et un OR, en réutilisant le « A XOR B » déjà calculé ; relie à « Cout ».',
          'Clique « Vérifier ».',
          'Astuce : en mode libre tu pourras enregistrer ce circuit comme composant réutilisable, ou utiliser le composant « Additionneur » intégré.',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'XOR', 'NAND', 'NOR'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }, { name: 'Cin', width: 1 }],
        outputs: [{ name: 'S', width: 1 }, { name: 'Cout', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0, 0], [0, 0]],
          [[0, 0, 1], [1, 0]],
          [[0, 1, 0], [1, 0]],
          [[0, 1, 1], [0, 1]],
          [[1, 0, 0], [1, 0]],
          [[1, 0, 1], [0, 1]],
          [[1, 1, 0], [0, 1]],
          [[1, 1, 1], [1, 1]],
        ],
      },
      {
        id: 'adder-4bit',
        title: 'Additionneur 4 bits',
        objective:
          'Additionner deux nombres de 4 bits d\'un seul coup, grâce au composant « Additionneur ».',
        steps: [
          'Crée une Entrée « A », sélectionne-la et règle sa Largeur sur 4 bits.',
          'Crée de même une Entrée « B » de 4 bits, puis une Entrée « Cin » de 1 bit.',
          'Crée une Sortie « S » de 4 bits, puis une Sortie « Cout » de 1 bit.',
          'Place le composant « Additionneur » (catégorie Arithmétique) et règle sa largeur sur 4 bits.',
          'Relie A → A, B → B, Cin → Cin, puis S → S et Cout → Cout.',
          'Clique « Vérifier ». Observe : quand le résultat dépasse 15, Cout passe à 1.',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'ADDER'],
        inputs: [{ name: 'A', width: 4 }, { name: 'B', width: 4 }, { name: 'Cin', width: 1 }],
        outputs: [{ name: 'S', width: 4 }, { name: 'Cout', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0, 0], [0, 0]],
          [[3, 5, 0], [8, 0]],
          [[7, 8, 0], [15, 0]],
          [[15, 1, 0], [0, 1]],
          [[9, 9, 1], [3, 1]],
        ],
      },
    ],
  },

  {
    id: 'sequentiel',
    title: 'Circuits séquentiels',
    levels: [
      {
        id: 'sr-latch',
        title: 'Verrou SR',
        objective:
          'Découvrir la plus petite mémoire : un verrou SR retient 1 bit. S = 1 le met à 1, R = 1 le remet à 0, et quand S = R = 0 il conserve sa valeur.',
        steps: [
          'Crée l\'Entrée « S », puis l\'Entrée « R ».',
          'Crée la Sortie « Q ».',
          'Place le composant « Verrou SR » (Latch SR).',
          'Relie S → S, R → R, et la sortie Q du verrou → « Q ».',
          'Clique « Vérifier » : une séquence d\'impulsions testera la mémorisation.',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'SRLATCH'],
        inputs: [{ name: 'S', width: 1 }, { name: 'R', width: 1 }],
        outputs: [{ name: 'Q', width: 1 }],
        verify: {
          type: 'sequence',
          steps: [
            [[0, 0], [0]],  // repos : Q part à 0
            [[1, 0], [1]],  // set
            [[0, 0], [1]],  // repos : reste à 1 (mémoire)
            [[0, 1], [0]],  // reset
            [[0, 0], [0]],  // repos : reste à 0
          ],
        },
      },
      {
        id: 'register-load',
        title: 'Registre avec chargement',
        objective:
          'Utiliser un registre : il mémorise un nombre de 4 bits et ne le met à jour que lorsqu\'on l\'y autorise (LD = 1), au front montant de l\'horloge.',
        steps: [
          'Crée une Entrée « D » de 4 bits, une Entrée « LD » de 1 bit, une Entrée « CLK » de 1 bit (dans cet ordre).',
          'Crée une Sortie « Q » de 4 bits.',
          'Place le composant « Registre » et règle sa largeur sur 4 bits.',
          'Relie D → D, LD → LD, CLK → CLK, puis la sortie Q → « Q ».',
          'Clique « Vérifier ». Rappel : au front montant, Q prend D si LD = 1, sinon Q garde sa valeur.',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'REG'],
        inputs: [{ name: 'D', width: 4 }, { name: 'LD', width: 1 }, { name: 'CLK', width: 1 }],
        outputs: [{ name: 'Q', width: 4 }],
        verify: {
          type: 'sequence',
          steps: [
            [[5, 1, 0], [0]],   // CLK bas : rien
            [[5, 1, 1], [5]],   // front montant, LD=1 → charge 5
            [[9, 0, 0], [5]],   // CLK bas
            [[9, 0, 1], [5]],   // front montant mais LD=0 → conserve 5
            [[2, 1, 0], [5]],   // CLK bas
            [[2, 1, 1], [2]],   // front montant, LD=1 → charge 2
          ],
        },
      },
      {
        id: 'shift-register',
        title: 'Registre à décalage',
        objective:
          'Construire un registre à décalage : à chaque coup d\'horloge, les bits avancent d\'une case et un nouveau bit (Din) entre par la gauche.',
        steps: [
          'Crée l\'Entrée « Din » (1 bit), puis l\'Entrée « CLK » (1 bit).',
          'Crée 4 Sorties dans l\'ordre : « Q0 », « Q1 », « Q2 », « Q3 ».',
          'Place 4 « Bascule D » (1 bit chacune) à la suite.',
          'Chaîne-les : Din → D de la bascule 0 ; Q de la bascule 0 → D de la bascule 1 ; etc.',
          'Relie la MÊME horloge CLK au CLK de chaque bascule.',
          'Relie les sorties Q des bascules aux sorties « Q0 » … « Q3 », puis clique « Vérifier ».',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'DFF'],
        inputs: [{ name: 'Din', width: 1 }, { name: 'CLK', width: 1 }],
        outputs: [
          { name: 'Q0', width: 1 }, { name: 'Q1', width: 1 },
          { name: 'Q2', width: 1 }, { name: 'Q3', width: 1 },
        ],
        verify: {
          type: 'sequence',
          steps: [
            [[1, 0], [0, 0, 0, 0]],
            [[1, 1], [1, 0, 0, 0]],  // front : 1 entre
            [[1, 0], [1, 0, 0, 0]],
            [[1, 1], [1, 1, 0, 0]],  // front : 1 entre, l'ancien décale
            [[0, 0], [1, 1, 0, 0]],
            [[0, 1], [0, 1, 1, 0]],  // front : 0 entre, tout décale
          ],
        },
      },
    ],
  },

  {
    id: 'processeur',
    title: 'Vers le processeur',
    levels: [
      {
        id: 'program-counter',
        title: 'Compteur de programme (PC)',
        objective:
          'Construire un compteur de programme (PC) : il indique l\'adresse de la prochaine instruction et avance de 1 à chaque coup d\'horloge.',
        steps: [
          'Crée les Entrées dans l\'ordre : « EN » (autorise le comptage), « CLK », « RST » (remise à zéro).',
          'Crée une Sortie « Q » de 3 bits (adresses 0 à 7).',
          'Place le composant « Compteur » et règle sa largeur sur 3 bits.',
          'Relie EN → EN, CLK → CLK, RST → RST, puis Q → « Q ».',
          'Clique « Vérifier ». Rappel : au front montant, Q + 1 si EN = 1 ; RST = 1 force Q à 0.',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'COUNTER'],
        inputs: [{ name: 'EN', width: 1 }, { name: 'CLK', width: 1 }, { name: 'RST', width: 1 }],
        outputs: [{ name: 'Q', width: 3 }],
        verify: {
          type: 'sequence',
          steps: [
            [[0, 0, 1], [0]],  // reset
            [[1, 1, 0], [1]],  // front, EN=1 → 1
            [[1, 0, 0], [1]],
            [[1, 1, 0], [2]],  // front → 2
            [[0, 0, 0], [2]],
            [[0, 1, 0], [2]],  // front mais EN=0 → conserve 2
            [[1, 0, 0], [2]],
            [[1, 1, 0], [3]],  // front, EN=1 → 3
          ],
        },
      },
      {
        id: 'bitwise-and',
        title: 'ET bit à bit (4 bits)',
        objective:
          'Appliquer un ET « bit à bit » sur deux nombres de 4 bits. Comme les portes de base ne traitent qu\'un bit, il faut séparer les bus en bits, combiner, puis regrouper.',
        steps: [
          'Crée une Entrée « A » (4 bits), puis une Entrée « B » (4 bits).',
          'Crée une Sortie « R » (4 bits).',
          'Place un « Séparateur » (largeur 4) sur A et un autre sur B : chacun éclate son bus en 4 fils.',
          'Place 4 portes AND. Relie à chacune un bit de A et le bit de MÊME rang de B.',
          'Place un « Fusionneur » (largeur 4) et envoie-lui les 4 résultats (chaque bit sur l\'entrée de même rang).',
          'Relie la sortie du Fusionneur à « R », puis clique « Vérifier ».',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'SPLITTER', 'MERGER', 'AND'],
        inputs: [{ name: 'A', width: 4 }, { name: 'B', width: 4 }],
        outputs: [{ name: 'R', width: 4 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[12, 10], [8]],
          [[15, 9], [9]],
          [[7, 14], [6]],
          [[0, 15], [0]],
          [[15, 15], [15]],
        ],
      },
      {
        id: 'alu-4bit',
        title: 'ALU 4 bits',
        objective:
          'Construire une ALU (unité de calcul) 4 bits : selon un code Op (2 bits) elle réalise A+B, A ET B, A OU B, ou NON A. C\'est le cœur de calcul du processeur.',
        steps: [
          'Crée les Entrées : « A » (4 bits), « B » (4 bits), « Op » (2 bits). Crée la Sortie « R » (4 bits).',
          'Op = 0 (ADD) : utilise le composant « Additionneur » (4 bits) sur A et B.',
          'Op = 1 (ET) et Op = 2 (OU) : comme au niveau précédent, sépare A et B en bits, applique des AND (puis des OR), et regroupe avec un Fusionneur.',
          'Op = 3 (NON A) : sépare A, applique un NOT sur chaque bit, puis regroupe.',
          'Place un « Multiplexeur » (sélecteur 2 bits, données 4 bits). Branche les 4 résultats sur ses entrées 0, 1, 2, 3 et « Op » sur le sélecteur.',
          'Relie la sortie du multiplexeur à « R », puis clique « Vérifier ».',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'ADDER', 'SPLITTER', 'MERGER', 'AND', 'OR', 'NOT', 'MUX'],
        inputs: [{ name: 'A', width: 4 }, { name: 'B', width: 4 }, { name: 'Op', width: 2 }],
        outputs: [{ name: 'R', width: 4 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[5, 3, 0], [8]],    // ADD
          [[9, 6, 0], [15]],   // ADD
          [[12, 10, 1], [8]],  // AND
          [[12, 10, 2], [14]], // OR
          [[5, 0, 3], [10]],   // NOT A
          [[15, 15, 1], [15]], // AND
        ],
      },
      {
        id: 'register-file',
        title: 'Banque de 4 registres',
        objective:
          'Construire une banque de 4 registres de 4 bits (la mémoire de travail du processeur). On choisit un registre avec Addr ; la lecture est continue, l\'écriture se fait au front d\'horloge si WE = 1.',
        steps: [
          'Crée les Entrées : « Addr » (2 bits), « Din » (4 bits), « WE » (1 bit), « CLK » (1 bit). Crée la Sortie « Dout » (4 bits).',
          'Place 4 « Registre » de 4 bits. Relie « Din » au D de chacun et « CLK » au CLK de chacun.',
          'Écriture : place un « Décodeur » 2→4 sur « Addr ». Pour chaque registre i, fais un AND entre la sortie i du décodeur et « WE », et relie-le au LD du registre i.',
          'Lecture : place un « Multiplexeur » (sélecteur 2 bits, données 4 bits), branche les 4 sorties Q des registres sur ses entrées, et « Addr » sur le sélecteur.',
          'Relie la sortie du multiplexeur à « Dout », puis clique « Vérifier ».',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'REG', 'MUX', 'DECODER', 'AND'],
        inputs: [
          { name: 'Addr', width: 2 }, { name: 'Din', width: 4 },
          { name: 'WE', width: 1 }, { name: 'CLK', width: 1 },
        ],
        outputs: [{ name: 'Dout', width: 4 }],
        verify: {
          type: 'sequence',
          steps: [
            [[0, 5, 1, 0], [0]],  // CLK bas : lecture reg0 = 0
            [[0, 5, 1, 1], [5]],  // front : écrit 5 dans reg0, relit reg0 = 5
            [[1, 9, 1, 0], [0]],  // adresse reg1 (vide) = 0
            [[1, 9, 1, 1], [9]],  // front : écrit 9 dans reg1, relit reg1 = 9
            [[0, 0, 0, 0], [5]],  // relit reg0 = 5 (toujours là)
            [[1, 0, 0, 0], [9]],  // relit reg1 = 9
          ],
        },
      },
      {
        id: 'accumulator',
        title: 'Accumulateur',
        objective:
          'Construire un accumulateur : un registre qui ajoute l\'entrée IN à son total à chaque coup d\'horloge. C\'est une boucle : la sortie du registre repart dans un additionneur.',
        steps: [
          'Crée une Entrée « IN » (4 bits), puis une Entrée « CLK » (1 bit). Crée la Sortie « ACC » (4 bits).',
          'Place une « Bascule D » de 4 bits (le total) et un « Additionneur » de 4 bits.',
          'Relie la sortie Q de la bascule → entrée A de l\'additionneur ; « IN » → entrée B ; laisse Cin à 0.',
          'Reboucle : la somme S de l\'additionneur → entrée D de la bascule. Relie « CLK » au CLK de la bascule.',
          'Relie la sortie Q de la bascule à « ACC », puis clique « Vérifier ».',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'ADDER', 'DFF'],
        inputs: [{ name: 'IN', width: 4 }, { name: 'CLK', width: 1 }],
        outputs: [{ name: 'ACC', width: 4 }],
        verify: {
          type: 'sequence',
          steps: [
            [[3, 0], [0]],
            [[3, 1], [3]],   // front : 0 + 3
            [[5, 0], [3]],
            [[5, 1], [8]],   // front : 3 + 5
            [[4, 0], [8]],
            [[4, 1], [12]],  // front : 8 + 4
          ],
        },
      },
      {
        id: 'mini-cpu',
        title: 'Mini-processeur',
        objective:
          'Assembler un mini-processeur à accumulateur (un cycle par instruction) : un registre ACC qui devient « ACC (opération) Imm » à chaque coup d\'horloge. C\'est l\'aboutissement : ALU + mémoire d\'état + horloge.',
        steps: [
          'Crée les Entrées : « Op » (2 bits), « Imm » (4 bits), « Reset » (1 bit), « CLK » (1 bit). Crée la Sortie « ACC » (4 bits).',
          'Place une « Bascule D » de 4 bits : ce sera l\'accumulateur ACC. Relie « Reset » à son RST et « CLK » à son CLK.',
          'Construis une ALU 4 bits (comme au niveau ALU) avec A = la sortie Q de la bascule (ACC) et B = « Imm ». Op = 0 ADD, 1 ET, 2 OU, 3 NON ACC.',
          'Reboucle : la sortie de l\'ALU → entrée D de la bascule ; la sortie Q de la bascule → « ACC ».',
          'Clique « Vérifier » : une petite suite d\'instructions sera jouée coup d\'horloge par coup d\'horloge.',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'ADDER', 'SPLITTER', 'MERGER', 'AND', 'OR', 'NOT', 'MUX', 'DFF'],
        inputs: [
          { name: 'Op', width: 2 }, { name: 'Imm', width: 4 },
          { name: 'Reset', width: 1 }, { name: 'CLK', width: 1 },
        ],
        outputs: [{ name: 'ACC', width: 4 }],
        verify: {
          type: 'sequence',
          steps: [
            [[0, 0, 1, 0], [0]],   // Reset
            [[0, 5, 0, 1], [5]],   // ADD : 0 + 5
            [[0, 3, 0, 0], [5]],
            [[0, 3, 0, 1], [8]],   // ADD : 5 + 3
            [[1, 12, 0, 0], [8]],
            [[1, 12, 0, 1], [8]],  // ET : 8 & 12
            [[2, 3, 0, 0], [8]],
            [[2, 3, 0, 1], [11]],  // OU : 8 | 3
            [[3, 0, 0, 0], [11]],
            [[3, 0, 0, 1], [4]],   // NON : ~11 → 4
            [[0, 1, 1, 0], [0]],   // Reset
          ],
        },
      },
    ],
  },

  {
    id: 'plus-loin',
    title: 'Pour aller plus loin',
    levels: [
      {
        id: 'mux2to1',
        title: 'Multiplexeur 2→1',
        objective:
          'Construire un multiplexeur 2→1 (un aiguillage) : selon le sélecteur S, la sortie Y recopie A (si S = 0) ou B (si S = 1).',
        steps: [
          'Crée les Entrées « A », « B », « S » (1 bit chacune). Crée la Sortie « Y ».',
          'Calcule (A ET NON S) : un NOT sur S, puis un AND avec A.',
          'Calcule (B ET S) : un AND avec B et S.',
          'Combine les deux résultats avec un OR, relie-le à « Y », puis clique « Vérifier ».',
          'Rappel : Y = (A ET NON S) OU (B ET S).',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }, { name: 'S', width: 1 }],
        outputs: [{ name: 'Y', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0, 0], [0]],
          [[1, 0, 0], [1]],
          [[0, 1, 0], [0]],
          [[1, 1, 0], [1]],
          [[0, 0, 1], [0]],
          [[1, 0, 1], [0]],
          [[0, 1, 1], [1]],
          [[1, 1, 1], [1]],
        ],
      },
      {
        id: 'decoder2to4',
        title: 'Décodeur 2→4',
        objective:
          'Construire un décodeur 2→4 : pour une entrée AB (A = bit de poids fort), une seule des 4 sorties s\'allume — celle dont le numéro vaut AB.',
        steps: [
          'Crée les Entrées « A », puis « B » (1 bit). Crée 4 Sorties : « Y0 », « Y1 », « Y2 », « Y3 ».',
          'Avec des portes NOT, prépare NON A et NON B.',
          'Y0 = NON A ET NON B ; Y1 = NON A ET B ; Y2 = A ET NON B ; Y3 = A ET B (une porte AND pour chaque).',
          'Relie chaque AND à sa sortie, puis clique « Vérifier ».',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'NOT', 'NAND', 'NOR'],
        inputs: [{ name: 'A', width: 1 }, { name: 'B', width: 1 }],
        outputs: [
          { name: 'Y0', width: 1 }, { name: 'Y1', width: 1 },
          { name: 'Y2', width: 1 }, { name: 'Y3', width: 1 },
        ],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0], [1, 0, 0, 0]],
          [[0, 1], [0, 1, 0, 0]],
          [[1, 0], [0, 0, 1, 0]],
          [[1, 1], [0, 0, 0, 1]],
        ],
      },
      {
        id: 'comparator2bit',
        title: 'Comparateur 2 bits',
        objective:
          'Comparer deux nombres de 2 bits A (= A1 A0) et B (= B1 B0). Trois sorties : ALT (A < B), AEQ (A = B), AGT (A > B).',
        steps: [
          'Crée les Entrées dans l\'ordre : « A1 », « A0 », « B1 », « B0 » (A1 et B1 = bits de poids fort). Crée les Sorties « ALT », « AEQ », « AGT ».',
          'Égalité (AEQ) : A = B quand A1 = B1 ET A0 = B0. Deux bits sont égaux si NON(x XOR y) ; combine les deux égalités avec un AND.',
          'Supériorité (AGT) : A > B si A1 > B1, ou si A1 = B1 et A0 > B0 (« x > y » vaut « x ET NON y »).',
          'Infériorité (ALT) : c\'est le cas restant — ni égal ni supérieur — donc NON(AEQ OU AGT).',
          'Relie chaque résultat à sa sortie, puis clique « Vérifier ».',
        ],
        allowedTypes: ['INPUT', 'OUTPUT', 'AND', 'OR', 'NOT', 'NAND', 'NOR', 'XOR'],
        inputs: [
          { name: 'A1', width: 1 }, { name: 'A0', width: 1 },
          { name: 'B1', width: 1 }, { name: 'B0', width: 1 },
        ],
        outputs: [{ name: 'ALT', width: 1 }, { name: 'AEQ', width: 1 }, { name: 'AGT', width: 1 }],
        verify: { type: 'truthtable' },
        truthTable: [
          [[0, 0, 0, 0], [0, 1, 0]],
          [[0, 0, 0, 1], [1, 0, 0]],
          [[0, 1, 0, 1], [0, 1, 0]],
          [[1, 0, 0, 1], [0, 0, 1]],
          [[1, 1, 1, 0], [0, 0, 1]],
          [[1, 1, 1, 1], [0, 1, 0]],
        ],
      },
    ],
  },
];

// Récupère un chapitre par ID
export function getChapter(chapterId) {
  return CHAPTERS.find((ch) => ch.id === chapterId);
}

// Récupère un niveau par chapitre et ID
export function getLevel(chapterId, levelId) {
  const chapter = getChapter(chapterId);
  return chapter ? chapter.levels.find((l) => l.id === levelId) : null;
}

// Liste plate de tous les niveaux (avec leur chapterId)
export function getAllLevels() {
  const all = [];
  for (const chapter of CHAPTERS) {
    for (const level of chapter.levels) {
      all.push({ ...level, chapterId: chapter.id });
    }
  }
  return all;
}
