// The harder text-structure passages: level 2 of the lesson.
//
// The first forty passages (lib/text-structure.ts) follow the teacher's
// paragraph frames. Almost every sentence opens on a signal word, so after a
// few weeks the structure can be read off the sentence openers without
// reading the passage, and the lesson has nothing left to teach.
//
// These are built differently, and the tests hold them to it:
//   * longer, in Grade 4 words (100 to 150 words against about 70);
//   * the structure is carried by the meaning: at most three signal words of
//     its own, none of them a frame opener;
//   * each carries a signal word that belongs to another structure, used the
//     way real writing uses it ("so", "also", "first", "because"), so hunting
//     for one word gives the wrong answer and reading the whole thing does not;
//   * no word in a title is shared, so no title can point at a structure.
//
// Eight per structure, the same count as level 1 and for the same reason:
// a session can skip everything from his last three (STRUCTURE_HISTORY).
// Topics ride his science and reading units. Every fact is real.

import type { StructurePassage } from "@/lib/text-structure";

export const HARD_STRUCTURE_PASSAGES: readonly StructurePassage[] = [
  // ── Description ─────────────────────────────────────────────────────────
  {
    id: "hard-camels",
    source: "app",
    title: "Desert Camels",
    structure: "description",
    signalWords: ["also"],
    text: "A camel's body is built for life in the desert. Its wide, flat feet spread out on the sand, so the animal does not sink. Long eyelashes and nostrils that close keep blowing sand out. The hump on its back does not hold water, as many people think. It stores fat, which the camel can use for energy when food is hard to find. A camel can also go for days without drinking and then swallow many gallons in a few minutes. Thick fur on its back blocks the hot sun, while thin fur on its belly lets heat escape. Even its mouth is tough enough to chew thorny plants. From its feet to its eyelashes, every part of a camel fits the dry land where it lives.",
  },
  {
    id: "hard-coral",
    source: "app",
    title: "Coral City",
    structure: "description",
    signalWords: ["for example"],
    text: "A coral reef looks like a garden of stone, but it is alive. The reef is made by tiny animals called polyps, most of them smaller than a pea. Every polyp builds a hard cup around its soft body. Over many years, millions of these cups pile up and form a reef. Thousands of living things make their homes there. Bright fish hide in the cracks, and sea turtles rest under the ledges. For example, a clownfish spends its whole life near one small patch of reef. Reefs grow only in warm, clear, shallow water, because the polyps need sunlight. Some reefs are so large that astronauts can see them from space. A reef is one of the busiest places in the whole ocean.",
  },
  {
    id: "hard-lightning",
    source: "app",
    title: "Lightning Bolts",
    structure: "description",
    signalWords: ["also"],
    text: "Lightning is a giant spark of electricity in the sky. A single bolt is hotter than the surface of the sun, yet it lasts less than one second. Most lightning never touches the ground. It jumps from one part of a cloud to a different part. The bolts that do reach the earth usually strike tall things, such as trees and towers. Lightning also makes thunder. The air around a bolt heats up so quickly that it bursts outward with a boom. Light travels faster than sound, so we see the flash before we hear the noise. Somewhere on Earth, lightning flashes about fifty times every second. A storm may look far away, but its lightning can still be dangerous.",
  },
  {
    id: "hard-octopus",
    source: "app",
    title: "Eight Arms",
    structure: "description",
    signalWords: ["also"],
    text: "An octopus is one of the strangest animals in the sea. It has eight arms, three hearts, and blue blood. Its soft body has no bones at all, so a large octopus can squeeze through a hole the size of a coin. Each arm is lined with suckers that can taste what they touch. An octopus is also a master of hiding. Its skin can change color and pattern in less than a second to match rocks or sand. When danger comes close, it shoots out a cloud of dark ink and then swims away. Scientists have watched octopuses open jars and carry coconut shells for shelter. With its odd body and clever brain, an octopus is like no other animal.",
  },
  {
    id: "hard-capitol",
    source: "app",
    title: "Capitol Building",
    structure: "description",
    signalWords: ["in addition"],
    text: "The capitol is the most important building in a state's government. It usually stands in the center of the capital city, and many have a tall dome on top. Inside are large rooms called chambers, where lawmakers meet to talk about new laws. The governor often has an office in the building too. Visitors can sit in a gallery above the chambers and watch the lawmakers work. The halls are lined with paintings, flags, and statues that tell the state's history. In addition, many capitols keep famous papers in glass cases for people to see. School groups visit every year, because the building belongs to all the people of the state. A capitol is a busy workplace and a kind of museum at once.",
  },
  {
    id: "hard-locomotive",
    source: "app",
    title: "Iron Horse",
    structure: "description",
    signalWords: ["for example"],
    text: "A steam locomotive was a machine that ran on fire and water. At the back of the engine was a firebox, where a worker shoveled coal all day long. In front of the fire lay a long tank of water called the boiler. The engine had tall iron wheels joined by heavy rods. In front, a pointed frame called a cowcatcher pushed animals and branches off the track. The loud whistle warned people that a train was coming. A smokestack on top sent black clouds into the sky. For example, a traveler could spot a train from miles away just by its smoke. People called the locomotive the iron horse, because it did the work that horses had done before.",
  },
  {
    id: "hard-volcano-parts",
    source: "app",
    title: "Sleeping Volcano",
    structure: "description",
    signalWords: ["also"],
    text: "A volcano is an opening in Earth's crust where melted rock can reach the surface. Deep below it lies a pool of melted rock called magma. A long tube, or vent, leads from the magma up to the top. Around the vent is a bowl-shaped hole called a crater. The mountain itself is made of old lava and ash that hardened long ago. Some volcanoes have steep sides, while others are wide and low. Many are quiet for hundreds of years. Scientists call a quiet volcano dormant, a word that means sleeping. Volcanoes also give something to the people who live nearby. Farmers plant crops on the slopes, because the ash makes the soil rich. Even when a volcano sleeps, scientists watch it closely with special tools.",
  },
  {
    id: "hard-hummingbird",
    source: "app",
    title: "Tiny Fliers",
    structure: "description",
    signalWords: ["also"],
    text: "Hummingbirds are the smallest birds in the world. Some kinds weigh less than a penny. Their wings beat so fast that they make a humming sound, which gives the birds their name. A hummingbird can hover in one spot like a helicopter. It is the only bird that can fly backward. Its long, thin beak reaches deep into flowers to drink the sweet nectar inside. All that flying uses a great deal of energy. A hummingbird must also eat every few minutes during the day. Early each morning, it hurries off to find food. At night, its body slows down to save energy until the sun returns. This tiny bird lives a very fast life.",
  },

  // ── Sequence ────────────────────────────────────────────────────────────
  {
    id: "hard-paper",
    source: "app",
    title: "Trees Into Paper",
    structure: "sequence",
    signalWords: ["after that"],
    text: "Most paper begins its life in a forest. Workers cut down trees and trim off the branches. Trucks carry the logs to a mill, where machines strip away the bark. The bare wood is chopped into chips no bigger than a coin. The chips are cooked with water and chemicals until they turn into a thick, wet mush called pulp. After that, the pulp is sprayed onto a wide moving screen, so the water can drain away. Heavy rollers press the damp sheet flat, and heated rollers dry it. By the end of the line, the paper is wound into a roll taller than a person. Later, another machine cuts the giant roll into sheets for books and notebooks.",
  },
  {
    id: "hard-bill",
    source: "app",
    title: "Idea Becomes Law",
    structure: "sequence",
    signalWords: ["then"],
    text: "Every state law starts as an idea. Someone, often a voter, tells a lawmaker about a change the state needs. The lawmaker writes the idea down as a bill and brings it to the capitol. A small group of lawmakers, called a committee, studies the bill and may change some of its words. Then the bill goes to the whole chamber for a vote. If most members vote yes, the other chamber must study it and vote too. A bill that passes both chambers is sent to the governor. The governor reads it one last time. With the governor's signature, the bill at last becomes a law for everyone in the state.",
  },
  {
    id: "hard-canyon",
    source: "app",
    title: "Carving Canyons",
    structure: "sequence",
    signalWords: ["finally"],
    text: "A canyon takes millions of years to form. It begins with a river flowing across flat, high land. The moving water carries sand and small stones, which scrape the riverbed like sandpaper. Little by little, the river cuts a narrow groove into the rock. Rain and melting snow wash loose dirt down the sides and into the water. The river carries that dirt away, so the groove keeps getting deeper. Over a very long time, wind and ice break more rock off the walls, and the gap grows wide. Finally, a huge canyon stands where there was once only a plain. The river still runs along the bottom, and it is still cutting today.",
  },
  {
    id: "hard-hearing",
    source: "app",
    title: "Drum to Brain",
    structure: "sequence",
    signalWords: ["next", "then"],
    text: "When a drum is hit, its skin shakes back and forth very quickly. The shaking pushes on the air around the drum and makes invisible waves. These waves spread out in every direction, a little like ripples on a pond. Some of them enter your ear and travel down a short tunnel. At the end of the tunnel, the waves strike a thin skin called the eardrum, and it begins to shake too. Next, three tiny bones pass the shaking along to a part of the ear filled with liquid. Tiny hairs there turn the movement into signals. The signals race along a nerve to your brain. Only then do you hear the boom. The same journey happens for every sound you hear, and it takes less than a blink.",
  },
  {
    id: "hard-railroad-built",
    source: "app",
    title: "Rails Across America",
    structure: "sequence",
    signalWords: ["first", "after that"],
    text: "In 1863, two companies began to build a railroad across the United States. One company started in California and laid track toward the east. The other began in Nebraska and built toward the west. Workers first cleared the land and made it level. They set heavy wooden beams on the ground and spiked iron rails on top. Crews blasted tunnels through mountains and built bridges over rivers. Both crews worked through deep snow and summer heat. For six years the two lines crept closer, mile by mile. In May of 1869, they met at a place in Utah called Promontory Summit. A golden spike was hammered into the last rail. After that day, a trip that had taken months took about one week.",
  },
  {
    id: "hard-power-trip",
    source: "app",
    title: "Generator, Wire, Lamp",
    structure: "sequence",
    signalWords: ["then"],
    text: "Electricity makes a long trip before it lights a lamp. The trip begins at a power plant, where a spinning machine called a generator makes the electric current. The current leaves the plant on thick wires held up by tall metal towers. These wires carry it across fields and hills to the edge of town. There, at a substation, the power is made weaker so it will be safe for homes. Smaller wires on wooden poles then bring it down each street. One wire runs to a meter on the side of the house. From the meter, wires hidden in the walls lead to every switch and outlet. When you flip the switch, the journey ends, because the current has reached the lamp.",
  },
  {
    id: "hard-fossil",
    source: "app",
    title: "Becoming Fossils",
    structure: "sequence",
    signalWords: ["then"],
    text: "Long ago, a dinosaur died beside a muddy river. Before other animals could carry off its bones, a flood covered the body with sand and mud. More layers of mud piled on top year after year. The soft parts of the animal rotted away, but the hard bones stayed. As the layers grew heavier, the mud around the bones was pressed into rock. Water trickled slowly through the rock and left tiny bits of minerals inside the bones. In time, the bones themselves turned to stone. Millions of years passed. Wind and rain wore the rock away, and then one day a hiker noticed something odd sticking out of a hillside. Very few animals end up this way, so every fossil is a rare find.",
  },
  {
    id: "hard-salmon",
    source: "app",
    title: "Salmon Journey",
    structure: "sequence",
    signalWords: ["then"],
    text: "A salmon's life begins in a cold, clear stream. The young fish hatches from an egg hidden in the gravel. For about a year it stays in the stream and grows. When it is strong enough, it swims down the river to the ocean. There the salmon spends several years eating and growing large. Then one day it turns around and heads back toward the river where it was born. It swims against the current and even leaps up small waterfalls. At last the tired fish reaches its home stream. It lays eggs in the gravel, and the story begins again. Scientists think salmon find the way by smell, because each stream has a scent of its own.",
  },

  // ── Cause and effect ────────────────────────────────────────────────────
  {
    id: "hard-tsunami",
    source: "app",
    title: "Giant Waves",
    structure: "cause-effect",
    signalWords: ["so"],
    text: "Far out at sea, the ocean floor sometimes shifts suddenly during an earthquake. The sudden movement shoves a huge amount of water upward. That push sends long waves racing across the ocean as fast as a jet plane. In deep water the waves are low, and sailors may not even notice them. Near land, the sea becomes shallow, and the waves slow down and pile up. A wave that was three feet high can rise taller than a house. When it reaches the shore, the water floods streets and carries away cars and buildings. The first wave is often not the largest. More waves follow behind it, so people must stay on high ground for hours.",
  },
  {
    id: "hard-friction",
    source: "app",
    title: "Warm Hands",
    structure: "cause-effect",
    signalWords: ["because"],
    text: "On a cold morning, people rub their hands together without even thinking about it. The rubbing makes heat. When two surfaces slide against each other, they catch and drag, and that drag is called friction. Friction turns movement into warmth. The same thing happens in many other places. A bicycle's brakes grow hot after a long ride down a hill. A rope sliding quickly through your hands can burn your skin. A match bursts into flame because its tip is dragged across a rough strip. Friction also slows things down. A ball rolling across grass soon stops, while a ball on smooth ice keeps going much longer. Wherever things rub, heat and slowing follow.",
  },
  {
    id: "hard-railroad-west",
    source: "app",
    title: "Golden Spike",
    structure: "cause-effect",
    signalWords: ["so"],
    text: "When the railroad across America was finished in 1869, life in the West changed quickly. Trains could carry people from coast to coast in about a week, so thousands of families moved west to start farms. New towns sprang up beside the tracks, often around a single station. Farmers and ranchers could now send wheat and cattle to cities far away, and stores could sell goods from eastern factories. But the changes were not good for everyone. The trains brought hunters who killed millions of buffalo. Native American nations, who had lived on the plains first, depended on those herds for food. As the buffalo vanished and settlers took more land, the nations were forced from their homes.",
  },
  {
    id: "hard-leaning-plant",
    source: "app",
    title: "Leaning Plants",
    structure: "cause-effect",
    signalWords: ["as a result"],
    text: "A plant on a windowsill often leans toward the glass. It is not falling over. It is growing that way. Plants need light to make their food, and they can sense where the light is coming from. The side of the stem that faces away from the window grows faster than the sunny side. The longer side pushes the stem over, and the leaves tip toward the light. As a result, they catch more sun and the plant makes more food. If you turn the pot around, the plant will slowly bend back the other way within a few days. Gardeners also see this outdoors. A tree growing beside a tall building often reaches out to one side, away from the shade.",
  },
  {
    id: "hard-eruption",
    source: "app",
    title: "Pressure Below",
    structure: "cause-effect",
    signalWords: ["so"],
    text: "Deep inside the Earth, it is hot enough to melt rock. The melted rock, called magma, is lighter than the solid rock around it, so it slowly rises. It gathers in a chamber under a volcano. Gas is mixed into the magma, much like the bubbles in a bottle of soda. As more magma arrives, the pressure in the chamber builds. The rock above holds it down for a while, sometimes for hundreds of years. Then the pressure becomes too great. The ground cracks, the gas rushes out, and magma blasts through the opening. Ash shoots high into the sky and lava pours down the slopes. Towns nearby may be buried, and the ash can block sunlight for days.",
  },
  {
    id: "hard-cavity",
    source: "app",
    title: "Sugar Attack",
    structure: "cause-effect",
    signalWords: ["this is why"],
    text: "Your mouth is home to millions of tiny living things called bacteria. Most of the time they do little harm. But bacteria love sugar. When you eat candy or drink soda, they feed on the sugar left on your teeth. As they feed, they make acid. The acid eats into the hard outer layer of a tooth, called enamel. One sweet snack does not do much damage. Day after day, though, the acid wears a small hole in the enamel. Dentists call that hole a cavity. If nobody treats it, the hole grows deeper until it reaches the nerve, and then the tooth begins to ache. This is why dentists tell children to brush after eating sweets.",
  },
  {
    id: "hard-seasons",
    source: "app",
    title: "Winter Days",
    structure: "cause-effect",
    signalWords: ["so"],
    text: "In December, the sun sets early in the United States, and children may ride home from school in the dark. In June, it stays light until bedtime. The reason is the way our planet leans. Earth does not sit straight up as it travels around the sun. It is tilted to one side, like a spinning top that leans a little. For part of the year, the northern half of Earth tips toward the sun. Sunlight strikes it more directly and for more hours, so the days are long and warm. Six months later, the northern half tips away. The sun stays low in the sky and sets sooner. At the same time, the southern half of the world enjoys its summer.",
  },
  {
    id: "hard-beaver",
    source: "app",
    title: "Beaver Ponds",
    structure: "cause-effect",
    signalWords: ["so"],
    text: "When a beaver builds a dam across a stream, the whole valley changes. The wall of sticks and mud holds back the water, and a pond spreads out behind it. Trees at the edge of the pond drown and fall. Sunlight reaches the water, so new plants begin to grow there. Before long, insects arrive to eat the plants, and fish and frogs come to eat the insects. Ducks and herons follow the fish. The pond also soaks slowly into the ground, which keeps nearby land green during dry summers. When a fire sweeps through the forest, animals can hide in the wet valley. One small animal, working night after night, makes a home for hundreds of others.",
  },

  // ── Problem and solution ────────────────────────────────────────────────
  {
    id: "hard-snow-sheds",
    source: "app",
    title: "Buried Tracks",
    structure: "problem-solution",
    signalWords: ["solve"],
    text: "The men who built the railroad through the Sierra Nevada mountains faced terrible winters. Snow fell so deep that it buried the tracks, and avalanches swept down the slopes without warning. Trains could not get through for weeks at a time. Shoveling by hand was far too slow. The railroad company had to solve this quickly. Workers built long wooden sheds over the tracks in the worst places. The sheds had strong, slanted roofs, so sliding snow passed over the top and the rails below stayed clear. In the end, the company built about thirty-seven miles of these snow sheds. Trains ran through them like cars through a tunnel. The idea was simple, but it kept the railroad open all winter.",
  },
  {
    id: "hard-bird-glass",
    source: "app",
    title: "Invisible Glass",
    structure: "problem-solution",
    signalWords: ["fix"],
    text: "Every year, millions of birds die when they fly into windows. A bird does not understand glass. It sees the reflection of sky and trees and thinks the way ahead is open. Tall office buildings are dangerous, but so are ordinary houses. People who care about birds have found ways to help. Some stick small dots or stripes on the outside of the glass, a few inches apart, so birds can see that something is there. Others hang cords in front of large windows. Builders can also choose special glass with a pattern that birds notice but people hardly see. At night, cities ask offices to switch off their lights during the weeks when birds travel. No single fix works everywhere, but each one saves lives.",
  },
  {
    id: "hard-fog-nets",
    source: "app",
    title: "Water From Fog",
    structure: "problem-solution",
    signalWords: ["solution"],
    text: "In some mountain villages in Chile and Peru, it almost never rains. Families once had to walk for hours to buy water or wait for a truck to deliver it. Yet thick fog rolls in from the ocean on many mornings. Engineers wondered if the fog itself could be used, because fog is made of water. They stretched large nets of fine plastic mesh between tall poles on the hillsides. As the fog drifts through, tiny drops of water cling to the threads. The drops grow, slide down the net, and drip into a pipe that leads to a tank. One big net can collect dozens of gallons in a single day. The villagers now have water for drinking, washing, and even small gardens. The solution had been floating past them all along.",
  },
  {
    id: "hard-crosswalk",
    source: "app",
    title: "Busy Corner",
    structure: "problem-solution",
    signalWords: ["fix"],
    text: "Maple Street and Fifth Avenue meet next to an elementary school. Each morning, cars rushed through the corner while children waited for a chance to cross. Two students were nearly hit in one month. Worried parents went to a meeting of the city council and asked for help. The council members listened and then sent an engineer to study the traffic. A few weeks later, they voted to spend money on the corner. Workers painted bright crosswalks and put up a flashing sign. The city also hired a crossing guard for the hours before and after school. Cars now slow down long before they reach the school. Families say the walk feels safe, and the council plans to fix two more corners soon.",
  },
  {
    id: "hard-beach",
    source: "app",
    title: "Shrinking Beach",
    structure: "problem-solution",
    signalWords: ["solve"],
    text: "Waves and storms are always pulling sand away from the shore. In some towns, the beach grows narrower every year, and houses that once stood far from the water are now close to the edge. Towns have tried several ideas. Some pump sand from the sea floor back onto the beach with giant hoses. That works for a few years, but the waves carry the new sand off again. Others build walls of rock to break the force of the waves. A third idea costs less. Volunteers plant tough grasses on the dunes, because the roots hold the sand in place like a net. No town has found a way to solve the trouble forever, but together these steps slow the sea down.",
  },
  {
    id: "hard-braille",
    source: "app",
    title: "Reading by Touch",
    structure: "problem-solution",
    signalWords: ["solution"],
    text: "Two hundred years ago, people who were blind had almost no way to read. A few schools owned books with large raised letters, but the letters were hard to tell apart by touch. A single book could be too heavy for a child to carry. Louis Braille, a blind student in France, was only fifteen when he found a solution. He used patterns of small raised dots, no more than six in a group, to stand for each letter. A reader could feel a whole letter with one fingertip. The dots were also easy to write with a simple pointed tool. At first, teachers refused to use the new system. Today, braille is read in almost every country, on signs, elevator buttons, and books.",
  },
  {
    id: "hard-bee-fence",
    source: "app",
    title: "Bees on Guard",
    structure: "problem-solution",
    signalWords: ["solve"],
    text: "In parts of Kenya, farmers and elephants want the same land. A hungry elephant can eat or trample a family's whole corn crop in one night. Fences do not stop an animal that strong, and chasing it away is dangerous. Then a scientist noticed that elephants are afraid of bees. Bees sting the soft skin around their eyes and inside their trunks. Farmers began hanging beehives on wires around their fields, one hive every thirty feet. When an elephant bumps the wire, the hives swing and the angry bees pour out. The elephant turns and leaves. The farmers keep their corn, and they also earn money by selling honey. This living fence helps solve an old fight, and no elephants are hurt.",
  },
  {
    id: "hard-solar-night",
    source: "app",
    title: "Sunshine After Dark",
    structure: "problem-solution",
    signalWords: ["fix"],
    text: "Solar panels make electricity only while the sun is shining. People, however, use the most power in the evening, when they cook dinner and turn on the lights. For years this mismatch held solar energy back. Power companies needed a way to save daytime energy for the night. Today many of them connect their panels to giant batteries. The batteries fill up during the sunny hours and give the power back after sunset. Other places use extra daytime electricity to pump water up to a high lake. At night the water runs downhill through machines that make electricity again. Neither answer is perfect, because batteries and pumps cost a great deal. Still, each new fix brings cleaner power a little closer.",
  },

  // ── Compare and contrast ────────────────────────────────────────────────
  {
    id: "hard-gator-croc",
    source: "app",
    title: "Swamp Reptiles",
    structure: "compare-contrast",
    signalWords: ["while"],
    text: "Many people cannot tell an alligator from a crocodile. The two reptiles have long tails, short legs, and mouths full of sharp teeth. Each spends its days floating in warm water with only its eyes above the surface. A closer look shows how they differ. An alligator has a wide snout shaped like the letter U, and a crocodile has a narrow, pointed one. When an alligator shuts its mouth, most of its teeth are hidden. A crocodile's teeth still show, so it seems to be grinning. Alligators are usually dark, almost black. Crocodiles are lighter and more olive green. They live in separate places, too. Alligators like fresh water, such as swamps and rivers, while crocodiles can also live in salty water near the sea.",
  },
  {
    id: "hard-governments",
    source: "app",
    title: "Governing Americans",
    structure: "compare-contrast",
    signalWords: ["same"],
    text: "Americans live under two governments at once. The national government in Washington, D.C., makes laws for the whole country. It prints money, runs the army, and deals with other nations. A state government makes laws only for the people inside its borders. It runs public schools, gives out driver's licenses, and takes care of state roads. The two are built in much the same way. Each has a group of lawmakers, a leader, and courts with judges. The leader of the country is the president, and the leader of a state is the governor. Each one collects taxes to pay for its work. Sometimes their jobs overlap. After a big storm, for example, state and national workers often help a town together.",
  },
  {
    id: "hard-moths",
    source: "app",
    title: "Night Wings",
    structure: "compare-contrast",
    signalWords: ["unlike"],
    text: "Moths and butterflies belong to one big family of insects. Each begins life as a caterpillar and grows four wings covered with tiny scales. Even so, a careful watcher can tell them apart. Most butterflies fly in the daytime, and most moths come out after dark. A butterfly at rest folds its wings straight up over its back. A moth usually spreads its wings flat or wraps them around its body. Their feelers are a good clue as well. A butterfly's are thin with a small knob at the tip, and a moth's often look like little feathers. Butterflies tend to be brightly colored. Unlike butterflies, moths are more often brown or gray, because dull colors hide them on tree bark during the day.",
  },
  {
    id: "hard-wind-solar",
    source: "app",
    title: "Clean Power",
    structure: "compare-contrast",
    signalWords: ["both"],
    text: "Wind turbines and solar panels are two ways to make electricity without burning fuel. Both run without putting smoke into the air, and the wind and the sun never run out. They do their work differently, though. A turbine uses moving air to spin long blades, and the spinning runs a generator. A solar panel has no moving parts at all. It turns sunlight straight into electricity. Turbines need open, breezy places, such as hilltops and plains. Panels can go almost anywhere, even on the roof of a house. A turbine can keep working at night if the wind blows, but a panel stops when the sun goes down. Because each has weak moments, many power companies build the two side by side.",
  },
  {
    id: "hard-wagon-train",
    source: "app",
    title: "Westward Travelers",
    structure: "compare-contrast",
    signalWords: ["same", "alike"],
    text: "In the 1850s, a family heading to California packed a covered wagon and walked beside it for five or six months. Twenty years later, a family could make the trip by train in about one week. The two journeys crossed many of the same rivers, plains, and mountains, but they felt nothing alike. Wagon travelers cooked over campfires and slept on the ground. Train passengers ate at station restaurants and dozed in their seats. A wagon family faced storms, sickness, and broken wheels far from help. Riders on the train had a roof, a stove, and a conductor to call on. The wagon cost less, yet it could carry little. A train moved people, animals, and heavy goods, so whole towns could be supplied from the East.",
  },
  {
    id: "hard-weather-climate",
    source: "app",
    title: "Today's Sky",
    structure: "compare-contrast",
    signalWords: ["even though"],
    text: "Weather and climate are two words that people often mix up. Weather is what is happening outside right now. It may be rainy this morning and sunny by lunch. Climate is the usual pattern of weather in one place over many years. A desert has a dry climate, even though a storm may soak it now and then. Weather can be measured with a quick look at a thermometer. Climate takes at least thirty years of records to describe. A weather report helps you decide what to wear today, so most people check it each morning. Knowing the climate helps a farmer choose which crops to plant. One changes by the hour, and the other changes slowly, over a lifetime or longer.",
  },
  {
    id: "hard-dolphin-shark",
    source: "app",
    title: "Gray Fins",
    structure: "compare-contrast",
    signalWords: ["different"],
    text: "From a boat, a dolphin and a shark can look almost like twins. Each has a smooth gray body, a pointed fin on its back, and a strong tail. Under the skin, they could hardly be more different. A shark is a fish. It breathes through gills and never needs to leave the water. A dolphin is a mammal, like a dog or a person, so it must swim to the surface for air. A shark's skeleton is made of bendy cartilage, the stuff inside your ears, and a dolphin has real bones. Baby sharks take care of themselves from their first day. A young dolphin stays beside its mother for years and drinks her milk. Their tails even move in opposite ways, one side to side and the other up and down.",
  },
  {
    id: "hard-light-sound",
    source: "app",
    title: "Flash Before Boom",
    structure: "compare-contrast",
    signalWords: ["unlike"],
    text: "Light and sound are forms of energy that travel in waves. Each can bounce off a surface. A mirror sends light back, and a canyon wall sends back an echo. In other ways the two are far apart. Light is astonishingly fast. It could circle the Earth seven times in one second. Sound is much slower, which explains the gap between a lightning flash and its thunder. Sound also needs something to travel through, such as air, water, or a wall. Light does not. It crosses the empty space between the sun and Earth with no trouble at all. That explains how astronauts on the moon can see each other but cannot hear a shout. Unlike light, sound can turn corners easily, so you may hear a friend before you see her.",
  },
];
