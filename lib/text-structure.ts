// Text structure unit: the five nonfiction structures his class covers this
// week, the teacher's five take-home passages, and the paragraph frames she
// uses. Pure data plus pure functions — the lesson surface renders it, this
// module never touches React or the DB.
//
// The teacher's five passages are verbatim from her handout: he practices on
// the exact text she sent home, so school and app agree word for word. The
// frame slot labels and signal words follow her worksheet's pattern; the
// layout and prose of that worksheet are not reproduced here.
//
// Those five alone were not enough. The lesson used to walk all five in the
// order they are written here, every single time, so after two runs he could
// answer from position — "the third one is cause and effect" — without
// reading a word. Identifying structure is the whole skill, so the pool now
// holds several passages per structure and a session draws one of each in a
// random order. The extra passages ride his science units so the reading is
// not wasted on filler.
//
// Three per structure were still too few. A session repeated two or three of
// the last one's texts, he had seen all fifteen within a week, and on
// 2026-09-27 he answered from memory. The pool now holds eight per structure
// on many topics, and a session steers away from the passages he was dealt in
// his last few (see structureSession). The title is on screen before he
// answers, so no word in a title may point at one structure either: every
// title with "and" in it used to be compare and contrast.

import { shuffle } from "@/lib/math/rng";
import type { Rng } from "@/lib/math/types";

export type TextStructureId =
  | "description"
  | "sequence"
  | "cause-effect"
  | "problem-solution"
  | "compare-contrast";

export const STRUCTURE_IDS: readonly TextStructureId[] = [
  "description",
  "sequence",
  "cause-effect",
  "problem-solution",
  "compare-contrast",
];

export type TextStructure = {
  id: TextStructureId;
  /** What the teacher calls it. */
  name: string;
  /** The one question that identifies this structure. Grade-3 reading level. */
  question: string;
  /** Words a reader hunts for to spot this structure. */
  signalWords: readonly string[];
  /** Slot labels of the paragraph frame, in writing order. */
  frame: readonly string[];
};

const STRUCTURES: Record<TextStructureId, TextStructure> = {
  description: {
    id: "description",
    name: "Description",
    question: "Does it tell lots of facts about one topic?",
    signalWords: ["first", "in addition", "for example", "also", "another"],
    frame: ["Topic Sentence", "First", "In addition", "For example", "Concluding Sentence"],
  },
  sequence: {
    id: "sequence",
    name: "Sequence",
    question: "Does it tell what happens in order, step by step?",
    signalWords: ["first", "next", "then", "after that", "finally"],
    frame: ["Topic Sentence", "First", "Next", "Finally", "Concluding Sentence"],
  },
  "cause-effect": {
    id: "cause-effect",
    name: "Cause and Effect",
    question: "Does it tell why something happens and what it makes happen?",
    signalWords: ["because", "so", "cause", "effect", "as a result", "this is why"],
    frame: ["Topic Sentence", "(cause)", "That is why", "Another effect is", "Concluding Sentence"],
  },
  "problem-solution": {
    id: "problem-solution",
    name: "Problem and Solution",
    question: "Does it tell about a problem and ways to fix it?",
    signalWords: ["problem", "solution", "solve", "fix"],
    frame: [
      "Topic Sentence",
      "The problem is",
      "A solution is",
      "Another solution is",
      "Concluding Sentence",
    ],
  },
  "compare-contrast": {
    id: "compare-contrast",
    name: "Compare and Contrast",
    question: "Does it tell how two things are alike and different?",
    signalWords: ["both", "same", "alike", "different", "unlike", "while", "even though"],
    frame: [
      "Topic Sentence",
      "One way they are the same",
      "They both",
      "One way they are different",
      "Unlike",
      "Concluding Sentence",
    ],
  },
};

export const TEXT_STRUCTURES: readonly TextStructure[] = STRUCTURE_IDS.map(
  (id) => STRUCTURES[id]
);

export function structureById(id: TextStructureId): TextStructure {
  return STRUCTURES[id];
}

export type StructurePassage = {
  id: string;
  title: string;
  /** Verbatim from the teacher's handout. */
  text: string;
  structure: TextStructureId;
  /** Only the signal words that really appear in this text (tests verify). */
  signalWords: readonly string[];
  /**
   * "teacher" marks the five from her handout, which must stay word for word.
   * A test pins their text so a later edit cannot quietly reword his homework.
   */
  source: "teacher" | "app";
};

export const STRUCTURE_PASSAGES: readonly StructurePassage[] = [
  {
    id: "sea-otters",
    source: "teacher",
    title: "Sea Otters",
    structure: "description",
    signalWords: ["first", "in addition", "for example"],
    text: "Sea otters are amazing ocean animals with many interesting features. First, sea otters have thick, fluffy fur that keeps them warm in cold water. In addition, they use rocks as tools to crack open shellfish for food. For example, a sea otter will float on its back and bang a clam against a rock resting on its stomach. These features help sea otters survive well in their ocean home.",
  },
  {
    id: "butterfly-grows",
    source: "teacher",
    title: "How a Butterfly Grows",
    structure: "sequence",
    signalWords: ["first", "next", "after that", "finally"],
    text: "A butterfly changes through four amazing stages before it can fly. First, a butterfly starts out as a tiny egg laid on a leaf. Next, the egg hatches into a caterpillar that eats leaves and grows bigger. After that, the caterpillar forms a hard shell called a chrysalis around itself. Finally, a beautiful butterfly comes out of the chrysalis and flies away. Scientists call this amazing process metamorphosis.",
  },
  {
    id: "wildfires",
    source: "teacher",
    title: "Wildfires",
    structure: "cause-effect",
    signalWords: ["cause", "because", "as a result", "effect", "this is why"],
    text: "Dry weather can cause dangerous wildfires to start and spread quickly. Because there is very little rain for a long time, plants and trees become extremely dry. As a result, dry plants can catch fire easily from just one spark. Another effect is that wildfires can destroy homes, forests, and animal habitats. This is why firefighters work so hard to stop wildfires quickly.",
  },
  {
    id: "ocean-plastic",
    source: "teacher",
    title: "Ocean Plastic Pollution",
    structure: "problem-solution",
    signalWords: ["problem", "solution"],
    text: "Plastic trash in the ocean is a big problem for sea animals. The problem is that turtles and fish sometimes eat small pieces of plastic by mistake. A solution is to use reusable bags and water bottles instead of plastic ones. Another solution is to pick up litter at the beach before it can wash into the water. Everyone can help keep the ocean clean and safe for animals.",
  },
  {
    id: "frogs-toads",
    source: "teacher",
    title: "Frogs and Toads",
    structure: "compare-contrast",
    signalWords: [
      "one way they are the same",
      "they both",
      "one way they are different",
      "while",
      "unlike",
      "even though",
    ],
    text: "Frogs and toads look similar, but they have some important differences. One way they are the same is that both are amphibians that hatch from eggs laid in water. They both eat insects and other small bugs. One way they are different is that frogs have smooth, wet skin, while toads have dry, bumpy skin. Unlike frogs, toads spend most of their time on land instead of in water. Even though they look alike, frogs and toads live very different kinds of lives.",
  },
  // ── Extra passages, written for this app ────────────────────────────────
  // Same five structures, different texts, so the answer cannot be memorised
  // from where a passage sits. Topics ride his science units.
  {
    id: "cactus-plants",
    source: "app",
    title: "Cactus Plants",
    structure: "description",
    signalWords: ["first", "in addition", "another", "for example"],
    text: "A cactus is a plant built to live where there is almost no rain. First, a cactus has a thick stem that stores water for many months. In addition, its sharp spines keep hungry animals from biting into it. Another feature is its shallow roots, which spread wide to catch every drop. For example, a saguaro cactus can soak up water from a light shower in minutes. Every part of a cactus helps it live in the dry desert.",
  },
  {
    id: "owls-hunt",
    source: "app",
    title: "How Owls Hunt",
    structure: "description",
    signalWords: ["first", "also", "in addition", "for example"],
    text: "Owls have special body parts that make them great night hunters. First, an owl has huge eyes that let it see in almost no light. Its ears are also placed unevenly on its head, which helps it work out exactly where a sound came from. In addition, the soft edges of an owl's feathers make its wings nearly silent. For example, a mouse often hears nothing at all until the owl is already above it.",
  },
  {
    id: "water-cycle",
    source: "app",
    title: "How Rain Falls",
    structure: "sequence",
    signalWords: ["first", "next", "then", "finally"],
    text: "Water travels in a circle that never really stops. First, the sun heats water in lakes, rivers and the sea until it turns into water vapor. Next, the water vapor rises high into the cool air and gathers into clouds. Then the tiny drops inside the cloud bump together and grow heavier. Finally, the drops fall back to the ground as rain, and the journey starts again. Scientists call this circle the water cycle.",
  },
  {
    id: "planting-seed",
    source: "app",
    title: "Planting a Seed",
    structure: "sequence",
    signalWords: ["first", "next", "after that", "last"],
    text: "Growing a bean plant takes a few careful steps. First, fill a small pot with soft, damp soil. Next, push one bean seed about as deep as your finger and cover it over. After that, put the pot on a sunny windowsill and give it a little water each day. Last, watch for a green shoot to push up through the soil after about a week. With sun and water, that shoot will grow into a whole plant.",
  },
  {
    id: "leaves-change",
    source: "app",
    title: "Fall Leaves",
    structure: "cause-effect",
    signalWords: ["because", "as a result", "effect", "this is why"],
    text: "Leaves change color in the fall because the days grow shorter and colder. Trees stop making the green food color called chlorophyll when there is less sunlight. As a result, yellow and orange colors that were hiding all summer finally show. Another effect is that the leaf dries out and falls to the ground. This is why bare branches in winter are a normal, healthy sign and not a sick one.",
  },
  {
    id: "shaking-ground",
    source: "app",
    title: "Shaking Ground",
    structure: "cause-effect",
    signalWords: ["cause", "because", "as a result", "so"],
    text: "Huge slabs of rock under our feet can cause the ground to shake. Because these slabs press against each other for years, pressure builds up along their edges. When the rock finally slips, the stored energy races outward as waves. As a result, buildings above can sway, crack or even fall down. The waves lose strength as they travel, so towns far away feel only a gentle rocking.",
  },
  {
    id: "noisy-classroom",
    source: "app",
    title: "The Noisy Classroom",
    structure: "problem-solution",
    signalWords: ["problem", "solution", "solve"],
    text: "Reading is hard in a classroom that is full of noise. The problem is that voices from the hallway carry straight through an open door. One solution is a soft rug and cloth curtains, which soak up sound instead of bouncing it back. Another solution is a quiet corner with headphones for anyone who needs one. Small changes like these solve most of the noise without costing very much.",
  },
  {
    id: "saving-water",
    source: "app",
    title: "Saving Water",
    structure: "problem-solution",
    signalWords: ["problem", "one way to fix", "solution"],
    text: "Many towns run short of clean water in a long, dry summer. The problem is that people use the most water at exactly the time there is least of it. One way to fix this is to water gardens early in the morning, before the sun dries the soil. Another solution is to catch rain from the roof in a barrel and use it later. Saving a little water every day adds up to a great deal by the end of summer.",
  },
  {
    id: "camels-horses",
    source: "app",
    title: "Riding Animals",
    structure: "compare-contrast",
    signalWords: ["they both", "one way they are different", "while", "unlike", "even though"],
    text: "Camels and horses are large animals that people have ridden for hundreds of years. They both have long legs, eat plants and can carry heavy loads for miles. One way they are different is that a camel stores fat in its hump, while a horse has no hump at all. Unlike a horse, a camel can go for days without drinking. Even though both are strong, each one suits a very different kind of country.",
  },
  {
    id: "rivers-lakes",
    source: "app",
    title: "Rivers and Lakes",
    structure: "compare-contrast",
    signalWords: ["one way they are the same", "they both", "one way they are different", "unlike"],
    text: "Rivers and lakes are both bodies of fresh water, but they behave in different ways. One way they are the same is that they both give homes to fish, birds and water plants. They both also collect the rain that falls on the land around them. One way they are different is that a river always flows downhill toward the sea. Unlike a river, a lake sits still in a low dip in the ground.",
  },
  // ── Five more per structure (2026-09-28) ────────────────────────────────
  // Three each were memorised within a week. These spread over space,
  // history, sports, weather, food and his town, and keep the signal words
  // of one structure out of the others so each text has one clear answer.
  {
    id: "saturn",
    source: "app",
    title: "The Ringed Planet",
    structure: "description",
    signalWords: ["first", "in addition", "another", "for example", "also"],
    text: "Saturn is the sixth planet from the sun, and it has some very unusual features. First, it is circled by wide, bright rings made of countless chunks of ice and rock. In addition, Saturn is a giant ball of gas with no solid ground to stand on. Another surprise is how light it is for its size. For example, if you could find a bathtub big enough to hold it, Saturn would float! Scientists have also counted more than one hundred moons traveling around it.",
  },
  {
    id: "honeybees",
    source: "app",
    title: "Queens and Workers",
    structure: "description",
    signalWords: ["first", "in addition", "for example", "another"],
    text: "A honeybee hive is a busy home where almost every bee has a job. First, each hive has one queen, and she lays all of the eggs, sometimes more than a thousand in a single day. In addition, thousands of worker bees clean the hive, feed the young, and gather nectar from flowers. For example, a worker that finds a good patch of flowers does a wiggly dance to show the others where to fly. Another kind of bee, the drone, is a male that never gathers any food. Every bee in the hive has its place.",
  },
  {
    id: "great-wall",
    source: "app",
    title: "The Great Wall",
    structure: "description",
    signalWords: ["first", "in addition", "another", "for example"],
    text: "The Great Wall of China is one of the biggest things people have ever built. First, it is not really one wall but many walls, built and rebuilt over more than two thousand years. In addition, builders used whatever they could find nearby, such as stone, brick, wood, and packed earth. Another feature is its thousands of watchtowers, where soldiers kept watch for enemies. For example, guards on one tower could light a fire to warn soldiers far down the wall. Today, millions of visitors walk along the wall every year.",
  },
  {
    id: "hockey-gear",
    source: "app",
    title: "Helmets and Pads",
    structure: "description",
    signalWords: ["first", "in addition", "also", "for example"],
    text: "An ice hockey player wears a lot of gear to stay safe. First, every player wears a hard helmet, and many add a clear face shield to protect their eyes. In addition, thick pads cover the shoulders, elbows, and shins, where a flying puck or a fall could hurt. Players also wear padded gloves that still let them grip the stick. The goalie wears the most gear of all. For example, a goalie has giant leg pads and a big glove shaped like a baseball mitt for catching the puck.",
  },
  {
    id: "public-library",
    source: "app",
    title: "A Library Card",
    structure: "description",
    signalWords: ["first", "in addition", "another", "also", "for example"],
    text: "A public library is a place anyone in town can use for free. First, it holds thousands of books, from picture books to thick books about science and history. In addition, most libraries have computers that anyone can use to finish homework or look for a job. Another service is story time, when a librarian reads aloud to young children. Some libraries also lend surprising things. For example, a few let you borrow cake pans, board games, or even fishing poles. A library card opens the door to all of it.",
  },
  {
    id: "pancakes",
    source: "app",
    title: "Flour and Eggs",
    structure: "sequence",
    signalWords: ["first", "next", "then", "after that", "finally"],
    text: "Making pancakes is easy when you follow the steps in order. First, stir flour, sugar, baking powder, and a pinch of salt together in a big bowl. Next, whisk in milk, one egg, and a little melted butter until the batter is smooth. Then, with a grown-up's help, pour small circles of batter onto a hot, greased pan. After that, wait for bubbles to pop on top and flip each pancake over. Finally, cook the other side until it is golden brown, and breakfast is ready.",
  },
  {
    id: "rocket-launch",
    source: "app",
    title: "Blast Off",
    structure: "sequence",
    signalWords: ["first", "next", "then", "after that", "finally"],
    text: "A rocket launch happens in a few quick steps. First, the countdown reaches zero, and the engines roar to life with a burst of fire and smoke. Next, the rocket rises slowly off the launch pad. Then it speeds up, pushing higher and higher through the air. After that, the bottom part of the rocket runs out of fuel, breaks away, and falls back toward Earth. Finally, only minutes after liftoff, the spacecraft reaches space and begins to circle the planet.",
  },
  {
    id: "pony-express",
    source: "app",
    title: "Horses and Letters",
    structure: "sequence",
    signalWords: ["first", "next", "then", "after that", "finally"],
    text: "In 1860, the Pony Express carried mail across the American West faster than ever before. First, a rider in Missouri packed the letters into a leather cover that fit over his saddle. Next, he galloped to a station ten or fifteen miles away, where a fresh horse stood waiting. Then he swapped horses in about two minutes and raced on. After that, once he had ridden about seventy-five miles, he handed the mail to a new rider. Finally, about ten days after it left Missouri, the mail reached California.",
  },
  {
    id: "relay-race",
    source: "app",
    title: "Passing the Baton",
    structure: "sequence",
    signalWords: ["first", "next", "then", "after that", "finally"],
    text: "In a relay race, four runners share one race as a team. First, the starting runner crouches at the line and sprints away when the starter's pistol fires. Next, she races toward her teammate, who is already jogging forward inside a marked zone. Then she presses the baton into her teammate's open hand without slowing down. After that, the second and third runners each run their part of the track and pass the baton along. Finally, the fourth runner, called the anchor, carries the baton across the finish line.",
  },
  {
    id: "recycled-can",
    source: "app",
    title: "Back on the Shelf",
    structure: "sequence",
    signalWords: ["first", "next", "then", "after that", "finally"],
    text: "An empty soda can may come back as a brand-new can in about two months. First, you rinse the can and drop it in a recycling bin. Next, a truck carries it to a recycling center, where machines sort the cans from paper, plastic, and glass. Then the cans are crushed into heavy blocks and shipped to a factory. After that, the blocks are melted and rolled into long, thin sheets of metal. Finally, the sheets are cut and shaped into new cans, ready to be filled and sold again.",
  },
  {
    id: "salt-ice",
    source: "app",
    title: "Salt and Ice",
    structure: "cause-effect",
    signalWords: ["cause", "because", "as a result", "this is why", "effect"],
    text: "Salt can cause ice to melt even when the air is below freezing. Because salt mixes into the thin layer of water on top of the ice, that water has to get much colder before it can freeze again. As a result, the ice slowly turns into slush that plows can push away. This is why trucks spread salt on roads before a winter storm. Salt has another effect, too. The salty water that splashes off the road rusts cars and harms plants.",
  },
  {
    id: "tides",
    source: "app",
    title: "The Moon and the Sea",
    structure: "cause-effect",
    signalWords: ["cause", "because", "so", "as a result", "this is why"],
    text: "In most places, the ocean creeps up the beach and slides back down about twice a day. The main cause of these tides is the moon. Because the moon's gravity tugs on Earth's oceans, the water piles up into giant bulges. As Earth spins, a beach moves into a bulge and back out again, so the water rises and falls. As a result, a tide pool that is underwater in the morning can be dry by lunchtime. This is why people who fish or sail check a tide chart before they go.",
  },
  {
    id: "dust-bowl",
    source: "app",
    title: "The Dust Bowl",
    structure: "cause-effect",
    signalWords: ["because", "as a result", "this is why"],
    text: "In the 1930s, huge storms of dust swept across the Great Plains. Farmers had plowed up the deep-rooted prairie grass to plant wheat. When years of dry weather came, the crops died. Because no roots were left to hold the soil in place, strong winds lifted it into black clouds that hid the sun. As a result, many farms were ruined, and thousands of families packed up and moved west. This is why farmers today plant rows of trees to block the wind and keep plants growing on their land.",
  },
  {
    id: "racing-heart",
    source: "app",
    title: "A Racing Heart",
    structure: "cause-effect",
    signalWords: ["because", "as a result", "effect", "this is why"],
    text: "When you sprint across a soccer field, your whole body starts working harder. Your muscles need more oxygen to keep moving. Because of this, your heart beats faster to pump extra blood to them. As a result, you breathe quickly and deeply to pull in more air. Another effect of hard exercise is heat, and your body cools down by sweating. This is why coaches tell players to drink plenty of water during a game.",
  },
  {
    id: "bread-rises",
    source: "app",
    title: "How Bread Rises",
    structure: "cause-effect",
    signalWords: ["because", "as a result", "so"],
    text: "Yeast is a tiny living thing that bakers mix into bread dough. The yeast feeds on sugar in the dough and gives off a gas called carbon dioxide. Because the dough is stretchy, it traps the gas in thousands of little bubbles. As a result, the dough puffs up until it is about twice as big. When the bread bakes, the bubbles leave holes that make it soft and light. Yeast works faster when it is warm, so bakers often let dough rise in a cozy spot.",
  },
  {
    id: "turtle-lights",
    source: "app",
    title: "Turtles and Bright Lights",
    structure: "problem-solution",
    signalWords: ["problem", "solution"],
    text: "Baby sea turtles hatch at night from nests buried in the sand. To find the ocean, they crawl toward the brightest part of the sky, which is usually over the water. The problem is that lights from houses, hotels, and streets can shine even brighter. Many babies crawl the wrong way, toward roads and parking lots. One solution is to switch off beach lights during nesting season. Another solution is to use special red or orange bulbs, which are much harder for turtles to see.",
  },
  {
    id: "panama-canal",
    source: "app",
    title: "The Panama Canal",
    structure: "problem-solution",
    signalWords: ["problem", "solution"],
    text: "For hundreds of years, ships sailing between the Atlantic and Pacific oceans had a big problem. North and South America blocked the way, and ships had to sail all the way around the stormy tip of South America. That trip could take months and was very dangerous. The solution was to dig a canal across Panama, where the land is narrow. It opened in 1914. Giant locks lift each ship up to a lake in the middle and lower it back down on the other side. Today, crossing the canal takes less than a day.",
  },
  {
    id: "astronaut-exercise",
    source: "app",
    title: "How Astronauts Stay Strong",
    structure: "problem-solution",
    signalWords: ["problem", "solution"],
    text: "Floating in space looks like fun, but it is hard on the human body. On Earth, muscles and bones work all day to hold us up against gravity. The problem is that in space they hardly have to work at all, and they slowly grow weaker. One solution is exercise, about two hours every day. Astronauts run on a treadmill with stretchy straps that hold them down against the belt. Another solution is a special machine that pulls back like heavy weights would on Earth. These fixes help astronauts stay healthy on long trips.",
  },
  {
    id: "hot-city",
    source: "app",
    title: "Hot Roads and Rooftops",
    structure: "problem-solution",
    signalWords: ["problem", "solution"],
    text: "On a summer afternoon, a big city can be several degrees hotter than the countryside around it. The problem is that dark roads and rooftops soak up sunlight all day and give off heat long after the sun goes down. One solution is to plant more trees, whose shade keeps streets and sidewalks cool. Another solution is to paint rooftops white or a light color, since light colors bounce sunlight away. Some cities are building splash pads and shady parks where people can cool off, too.",
  },
  {
    id: "icehouse",
    source: "app",
    title: "Before Refrigerators",
    structure: "problem-solution",
    signalWords: ["problem", "solution"],
    text: "Long ago, before there were refrigerators, keeping food fresh was a big problem. In summer heat, milk turned sour and meat could spoil in a day or two. One solution was the icehouse. In winter, workers cut big blocks of ice from frozen lakes and packed them in sawdust inside a thick-walled shed. The ice could stay frozen for months and keep food cold through the summer. Another solution was to dry or salt meat and fish, which kept germs from growing. People still eat foods saved this way, like beef jerky.",
  },
  {
    id: "earth-mars",
    source: "app",
    title: "The Red Planet",
    structure: "compare-contrast",
    signalWords: ["one way they are the same", "they both", "one way they are different", "while", "unlike"],
    text: "Earth and Mars are neighbors in space, but they are very different places. One way they are the same is that both are rocky planets with mountains, valleys, and ice at their poles. They both have seasons, and a day on Mars is only about forty minutes longer than a day on Earth. One way they are different is that Earth has oceans of liquid water, while Mars is a cold, dusty desert. Unlike Earth, Mars has air far too thin for people to breathe.",
  },
  {
    id: "baseball-softball",
    source: "app",
    title: "Batter Up",
    structure: "compare-contrast",
    signalWords: ["alike", "one way they are the same", "they both", "one way they are different", "while", "unlike"],
    text: "Baseball and softball are alike in many ways. One way they are the same is that a batter hits the ball and runs around four bases to score. They both usually have nine players on the field for each team. One way they are different is the ball. A softball is about as big as a grapefruit, while a baseball is much smaller. Unlike a baseball pitcher, a softball pitcher throws the ball underhand. Even the bases are closer together in softball, only sixty feet apart instead of ninety.",
  },
  {
    id: "hurricanes-tornadoes",
    source: "app",
    title: "Wild Winds",
    structure: "compare-contrast",
    signalWords: ["both", "different", "while", "unlike", "even though", "alike"],
    text: "Hurricanes and tornadoes are both spinning storms with dangerous winds. Either one can rip roofs off houses and knock down trees. Still, the two storms are different in important ways. A hurricane can be hundreds of miles wide, while most tornadoes are less than a mile across. Unlike a tornado, which forms over land and often lasts only a few minutes, a hurricane forms over warm ocean water and can last for days. Even though they are alike in some ways, a hurricane is by far the bigger storm.",
  },
  {
    id: "honey-syrup",
    source: "app",
    title: "Pancake Toppings",
    structure: "compare-contrast",
    signalWords: ["one way they are the same", "they both", "one way they are different", "while", "unlike"],
    text: "Honey and maple syrup are two sweet, sticky foods that taste great on pancakes. One way they are the same is that both come from nature. They both contain lots of natural sugar and can keep for a long time. One way they are different is where they come from. Bees make honey from the nectar of flowers, while maple syrup starts as sap inside maple trees. Unlike honey, maple syrup has to be boiled for hours. It takes about forty gallons of sap to make just one gallon of syrup!",
  },
  {
    id: "north-south-poles",
    source: "app",
    title: "Ends of the Earth",
    structure: "compare-contrast",
    signalWords: ["alike", "both", "one way they are different", "while", "unlike"],
    text: "The North Pole and the South Pole sit at opposite ends of the Earth. They are alike in some ways. Both are covered in ice, and both stay cold all year long. At both poles, summer brings months of sunshine with no night, and winter brings months of darkness. One way they are different is what lies under the ice. The North Pole sits on a frozen ocean, while the South Pole sits on land in Antarctica. Unlike the North Pole, the South Pole is high up on a thick sheet of ice, which makes it much colder.",
  },
];

// ── "What structure is this?" choices ─────────────────────────────────────

export type StructureChoices = {
  /** The right structure plus distractors, in shuffled order. */
  options: TextStructure[];
  answer: TextStructureId;
};

/**
 * Multiple-choice options for one passage. Every wrong option is another real
 * structure from the unit — with only five structures, all of them are
 * plausible distractors. Same passage + same seed = same options, so the
 * runner and the server agree.
 */
export function structureChoices(
  passage: StructurePassage,
  rng: Rng,
  count = 4
): StructureChoices {
  const size = Math.max(2, Math.min(TEXT_STRUCTURES.length, Math.round(count)));
  const right = structureById(passage.structure);
  const others = TEXT_STRUCTURES.filter((s) => s.id !== passage.structure);
  const distractors = shuffle(rng, others).slice(0, size - 1);
  return {
    options: shuffle(rng, [right, ...distractors]),
    answer: right.id,
  };
}

// ── One session's worth of passages ───────────────────────────────────────

export type StructureRound = {
  passage: StructurePassage;
  choices: StructureChoices;
};

/** Every passage written for one structure. */
export function passagesFor(id: TextStructureId): StructurePassage[] {
  return STRUCTURE_PASSAGES.filter((p) => p.structure === id);
}

/**
 * One round per structure, each drawn from that structure's own passages, in
 * a shuffled order.
 *
 * The order matters as much as the draw. The lesson used to run the five
 * passages in the order they are declared, so the position of a passage was a
 * reliable tell — he could answer "cause and effect" third without reading.
 * Shuffling the order removes the tell.
 *
 * The extra round matters as much. With exactly one round per structure he can
 * answer the last one by elimination without reading it — the same shortcut in
 * a different disguise. A sixth round repeats one structure, so counting what
 * is left over no longer settles anything.
 *
 * And the texts themselves must be new. A random draw from three per
 * structure repeated two or three of the last session's texts, and he learned
 * the answers by heart. `recent` holds the ids dealt in his last few sessions,
 * oldest first (see rememberDealt): a passage in it is only dealt again when
 * its structure has nothing unseen left, and then the one seen longest ago.
 */
export const STRUCTURE_ROUNDS = STRUCTURE_IDS.length + 1;

/**
 * How many dealt ids to remember: three sessions' worth. A session takes at
 * most two texts of one structure, so three sessions use at most six of its
 * eight, and the next session still finds two he has not seen. Nothing from
 * his last three sessions comes back while every structure has eight.
 */
export const STRUCTURE_HISTORY = STRUCTURE_ROUNDS * 3;

/** `recent` with this session's passages added, trimmed to STRUCTURE_HISTORY. */
export function rememberDealt(
  recent: readonly string[],
  rounds: readonly StructureRound[]
): string[] {
  return [...recent, ...rounds.map((r) => r.passage.id)].slice(-STRUCTURE_HISTORY);
}

export function structureSession(
  rng: Rng,
  recent: readonly string[] = [],
  choiceCount = 4
): StructureRound[] {
  // Where each id last shows up in `recent`; a passage not in it is -1, older
  // than anything seen.
  const seenAt = new Map(recent.map((id, i) => [id, i] as const));
  const age = (p: StructurePassage) => seenAt.get(p.id) ?? -1;
  const pick = (pool: readonly StructurePassage[]): StructurePassage => {
    const oldest = Math.min(...pool.map(age));
    const fresh = pool.filter((p) => age(p) === oldest);
    return fresh[Math.min(fresh.length - 1, Math.floor(rng() * fresh.length))];
  };

  // Every structure gets practised...
  const chosen = STRUCTURE_IDS.map((id) => pick(passagesFor(id)));
  // ...and one gets a second turn, on a different text where there is one.
  const encore = STRUCTURE_IDS[Math.min(STRUCTURE_IDS.length - 1, Math.floor(rng() * STRUCTURE_IDS.length))];
  const taken = new Set(chosen.map((p) => p.id));
  const spare = passagesFor(encore).filter((p) => !taken.has(p.id));
  chosen.push(pick(spare.length > 0 ? spare : passagesFor(encore)));

  const rounds = chosen.map((passage) => ({
    passage,
    choices: structureChoices(passage, rng, choiceCount),
  }));
  return shuffle(rng, rounds);
}

// ── Signal word highlighting ──────────────────────────────────────────────

export type SignalMatch = {
  /** The signal word as listed, lowercase. */
  word: string;
  /** Position of the match in the text. */
  index: number;
  /** Length of the matched text, so the UI can slice it out. */
  length: number;
};

/** matchAll needs every regex-special character in a phrase escaped first. */
function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Every place a signal word shows up in a text, for highlighting. Matches are
 * case-insensitive and stop at word boundaries: "cause" does not light up
 * inside "because", but "First," with its comma is still found.
 */
export function findSignalWords(
  text: string,
  signalWords: readonly string[]
): SignalMatch[] {
  const matches: SignalMatch[] = [];
  for (const word of signalWords) {
    const pattern = new RegExp(`\\b${escapeRegExp(word)}\\b`, "gi");
    for (const hit of text.matchAll(pattern)) {
      if (hit.index !== undefined) {
        matches.push({ word: word.toLowerCase(), index: hit.index, length: hit[0].length });
      }
    }
  }
  return matches.sort((a, b) => a.index - b.index);
}
