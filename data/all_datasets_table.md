# EvidentAI Multimodal Benchmark Datasets (Master Table)

Total benchmark items: **120** across 3 visual domains:
- **ChartQA**: 50 items (Charts, plots, and bar/line/pie distributions)
- **ScienceQA**: 50 items (Scientific diagrams, experiments, biology, physics, maps)
- **SPIQA**: 20 items (Scientific paper figures, architectures, performance benchmark matrices)

All visual figures have been extracted into grounded 2D tabular formats.

| Dataset | Sample ID | Type | Question Summary | Ground Truth Answer | Extracted Table Schema |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **chartqa** | `chartqa_001` | `chart_table` | What was the revenue for North America in Q3 2023?... | $4.8M | Region / Q1 2023 / Q2 2023 / Q3 2023 / Q4 2023 |
| **chartqa** | `chartqa_002` | `chart_table` | How many TWh of Solar energy were produced in 2022?... | 1280 TWh | Source / 2019 / 2020 / 2021 / 2022 / 2023 |
| **chartqa** | `chartqa_003` | `chart_table` | What is Android's share of the global smartphone OS market?... | 70.5% | Operating System / Market Share |
| **chartqa** | `chartqa_004` | `chart_table` | What was the average EV battery pack cost in 2021?... | $138/kWh | Year / Cost ($/kWh) |
| **chartqa** | `chartqa_005` | `chart_table` | Which cloud provider holds the largest market share?... | AWS | Provider / Market Share |
| **chartqa** | `chartqa_006` | `chart_table` | What was total semiconductor revenue in 2021?... | $555B | Year / Revenue ($ Billion) |
| **chartqa** | `chartqa_007` | `chart_table` | Which model exhibits the lowest hallucination rate on ChartQA?... | Claude 3.5 Sonnet | Model / ChartQA Hallucination Rate / DocVQA Hallucination Rate |
| **chartqa** | `chartqa_008` | `chart_table` | What is the median household income for individuals with a Master's de... | $98,500 | Education Level / Median Income |
| **chartqa** | `chartqa_009` | `chart_table` | What percentage of carbon emissions comes from Electricity & Heat Prod... | 34% | Sector / Percentage |
| **chartqa** | `chartqa_0010` | `chart_table` | What was the mobile share of e-commerce sales in 2023?... | 73% | Year / Mobile Share / Desktop Share |
| **chartqa** | `chartqa_0011` | `chart_table` | How many test miles were driven in 2019?... | 15 M Miles | Category / Miles |
| **chartqa** | `chartqa_0012` | `chart_table` | What is the crude oil output for Saudi Arabia?... | 84.5 Mbpd | Category / Production |
| **chartqa** | `chartqa_0013` | `chart_table` | What are the lifetime sales for Xbox Series X/S?... | 49 M Units | Category / Sales |
| **chartqa** | `chartqa_0014` | `chart_table` | What percentage of the population is aged 55-64 yrs?... | 33.5 % | Category / Share |
| **chartqa** | `chartqa_0015` | `chart_table` | How many GW of solar capacity were added in Rest of World?... | 49 GW | Category / Capacity |
| **chartqa** | `chartqa_0016` | `chart_table` | What percentage of cyber security breaches targeted Healthcare?... | 13 % | Category / Percentage |
| **chartqa** | `chartqa_0017` | `chart_table` | What is the remote work adoption rate in Finance?... | 33.5 % | Category / Remote Share |
| **chartqa** | `chartqa_0018` | `chart_table` | What was the container shipping index in Q4 2023?... | 1414 Index | Category / Value |
| **chartqa** | `chartqa_0019` | `chart_table` | What is the AI diagnostic accuracy for Mammography?... | 88 % | Category / Accuracy |
| **chartqa** | `chartqa_0020` | `chart_table` | How many million bags of coffee did Ethiopia produce?... | 40 M Bags | Category / Production |
| **chartqa** | `chartqa_0021` | `chart_table` | How many subscribers does Netflix have?... | 112 Million | Category / Subscribers |
| **chartqa** | `chartqa_0022` | `chart_table` | What is the penetration rate for Thermostats?... | 31.5 % | Category / Penetration |
| **chartqa** | `chartqa_0023` | `chart_table` | What was the lithium output for Australia?... | 85 kt | Category / Output |
| **chartqa** | `chartqa_0024` | `chart_table` | What is the 5G population coverage in Germany?... | 56.5 % | Category / Coverage |
| **chartqa** | `chartqa_0025` | `chart_table` | How many billion downloads were logged for Finance?... | 28 Billion | Category / Downloads |
| **chartqa** | `chartqa_0026` | `chart_table` | How much VC funding went to AI & ML?... | 18 $ Billion | Category / Funding |
| **chartqa** | `chartqa_0027` | `chart_table` | What is the plastic recycling rate in South Korea?... | 17.5 % | Category / Recycled % |
| **chartqa** | `chartqa_0028` | `chart_table` | What was the qubit count milestone in 2022?... | 135 Qubits | Category / Qubit Count |
| **chartqa** | `chartqa_0029` | `chart_table` | How many orbital launches were conducted by Rocket Lab?... | 32.5 Launches | Category / Launches |
| **chartqa** | `chartqa_0030` | `chart_table` | What is the robot density per 10,000 workers in USA?... | 317 Units | Category / Robots/10k |
| **chartqa** | `chartqa_0031` | `chart_table` | What is the course completion rate for Computer Science?... | 12 % | Category / Completion Rate |
| **chartqa** | `chartqa_0032` | `chart_table` | What percentage of electricity comes from nuclear energy in Slovakia?... | 29.5 % | Category / Nuclear Share |
| **chartqa** | `chartqa_0033` | `chart_table` | How many million telemedicine visits occurred in 2022?... | 49 Million | Category / Visits |
| **chartqa** | `chartqa_0034` | `chart_table` | What is the inference latency for 64k tokens?... | 163.5 ms | Category / Latency |
| **chartqa** | `chartqa_0035` | `chart_table` | How many stores does Dominos operate globally?... | 18014 Stores | Category / Count |
| **chartqa** | `chartqa_0036` | `chart_table` | What is the desalination capacity of Saudi Arabia?... | 9 M m3/day | Category / Capacity |
| **chartqa** | `chartqa_0037` | `chart_table` | What is the onshore wind power capacity in USA?... | 75.5 GW | Category / Onshore GW |
| **chartqa** | `chartqa_0038` | `chart_table` | What was the tournament prize pool for League of Legends?... | 15 $ Million | Category / Prize Pool |
| **chartqa** | `chartqa_0039` | `chart_table` | How many million e-scooter trips were recorded in North America?... | 35 Million | Category / Trips |
| **chartqa** | `chartqa_0040` | `chart_table` | What was the chip delivery lead time in 2021 Q1?... | 18.5 Weeks | Category / Lead Time |
| **chartqa** | `chartqa_0041` | `chart_table` | What is the efficiency index for Potash?... | 74 Index | Category / Efficiency |
| **chartqa** | `chartqa_0042` | `chart_table` | What is the commercial vacancy rate in New York?... | 17.5 % | Category / Vacancy % |
| **chartqa** | `chartqa_0043` | `chart_table` | What is the passenger recovery rate for Domestic US?... | 82 % vs 2019 | Category / Recovery Rate |
| **chartqa** | `chartqa_0044` | `chart_table` | What was the global heat anomaly index in 2022?... | 1.09 deg C | Category / Anomaly |
| **chartqa** | `chartqa_0045` | `chart_table` | How many thousand graduates were recorded in Social Sciences?... | 459 Thousands | Category / Graduates |
| **chartqa** | `chartqa_0046` | `chart_table` | How much was invested in smart grids in Rest of Asia?... | 25.5 $ Billion | Category / Investment |
| **chartqa** | `chartqa_0047` | `chart_table` | What was the pretraining dataset size in 2021?... | 303.5 Billion Tokens | Category / Tokens |
| **chartqa** | `chartqa_0048` | `chart_table` | How many robot deliveries occurred in Suburban?... | 84.5 Thousands | Category / Deliveries |
| **chartqa** | `chartqa_0049` | `chart_table` | What was the battery recycling capacity in 2023?... | 24 GWh | Category / Capacity |
| **chartqa** | `chartqa_0050` | `chart_table` | What is the AI code completion acceptance rate for Go?... | 44 % | Category / Acceptance |
| **scienceqa** | `scienceqa_real_000` | `science_mc` | Which of the following could Gordon's test show?... | how steady a parachute with a 1 m v | Design Test Parameter / Experimental Value / Measurement Goal |
| **scienceqa** | `scienceqa_real_001` | `science_mc` | What is the name of the colony shown?... | New Hampshire | Colony / Territory / Colonial Status / Bordering Regions / Key Geographical Detail |
| **scienceqa** | `scienceqa_real_002` | `science_mc` | Which of these organisms contains matter that was once part of the lic... | mushroom | Organism / Trophic Level / Role / Food Source (Eats) / Consumed By (Arrow Points To) |
| **scienceqa** | `scienceqa_real_003` | `science_mc` | What is the expected ratio of offspring with a woolly fleece to offspr... | 4:0 | Parent Genotypes / Allele 1 (f) / Allele 2 (f) |
| **scienceqa** | `scienceqa_real_004` | `science_mc` | Which property do these three objects have in common?... | opaque | Object / Shiny? / Slippery? / Opaque (Does not transmit light)? |
| **scienceqa** | `scienceqa_real_005` | `science_mc` | Think about the magnetic force between the magnets in each pair. Which... | The magnitude of the magnetic force | Pair / Block Magnet Size / Horseshoe Magnet Size / Distance / Relative Magnetic Force Magnitude |
| **scienceqa** | `scienceqa_real_006` | `science_mc` | What is the capital of Wyoming?... | Cheyenne | US State / Capital City / Location / Geographic Feature / Highlighted in Map |
| **scienceqa** | `scienceqa_real_007` | `science_mc` | Is the following statement about our solar system true or false?
The l... | false | Planet / Volume Relative to Earth / Primary Composition / Category |
| **scienceqa** | `scienceqa_real_008` | `science_mc` | Which of the following organisms is the primary consumer in this food ... | copepod | Organism / Ecosystem Role / Primary Trophic Level / Diet / Arrows |
| **scienceqa** | `scienceqa_real_009` | `science_mc` | Think about the magnetic force between the magnets in each pair. Which... | The magnetic force is stronger in P | Magnet Pair / Magnet Poles Facing / Separation Distance / Magnetic Force Strength |
| **scienceqa** | `scienceqa_real_010` | `science_mc` | Which better describes the Daintree rain forest ecosystem?... | It has year-round rain. It also has | Ecosystem Feature / Daintree Rain Forest / Boreal Forest / Taiga / Observed Ecological Property |
| **scienceqa** | `scienceqa_real_011` | `science_mc` | What is the capital of Delaware?... | Dover | State / Capital / Geographic Region / Statehood |
| **scienceqa** | `scienceqa_real_012` | `science_mc` | Which of these states is farthest north?... | Maine | State Name / Latitude Range / Relative Geographic Position / Map Highlight |
| **scienceqa** | `scienceqa_real_013` | `science_mc` | What can Greta and Allie trade to each get what they want?... | Greta can trade her tomatoes for Al | Trader / Current Item Owned / Desired Item / Optimal Mutual Trade |
| **scienceqa** | `scienceqa_real_014` | `science_mc` | What is the capital of Colorado?... | Denver | State / Capital / Elevation / Region / Map Status |
| **scienceqa** | `scienceqa_real_015` | `science_mc` | Which continent is highlighted?... | Asia | Continent / Land Area (M sq km) / Highlighted Status / Key Boundary |
| **scienceqa** | `scienceqa_real_016` | `science_mc` | Identify the question that Chase's experiment can best answer.... | Do cardinals visit feeders containi | Experimental Component / Chase's Setup / Role in Scientific Method |
| **scienceqa** | `scienceqa_real_017` | `science_mc` | Which material is this path made of?... | brick | Material / Surface / Visual Texture & Color / Material Class / Present in Photo |
| **scienceqa** | `scienceqa_real_018` | `science_mc` | Select the bird below.... | ostrich | Organism Shown / Taxonomic Class / Distinguishing Features / Is a Bird? |
| **scienceqa** | `scienceqa_real_019` | `science_mc` | Which property do these three objects have in common?... | blue | Object / Visual Color / Shape / Texture / Property in Common |
| **scienceqa** | `scienceqa_real_020` | `science_mc` | Which of the following was a dependent variable in this experiment?... | the number of days until a seed ger | Variable Type / Variable in Experiment / Measurement Units / Method / Controlled Status |
| **scienceqa** | `scienceqa_real_021` | `science_mc` | What is the capital of Mississippi?... | Jackson | US State / Capital City / Region / Highlighted Map Marker |
| **scienceqa** | `scienceqa_real_022` | `science_mc` | Which property matches this object?... | stretchy | Object / Material / Elastic Property / Property Match |
| **scienceqa** | `scienceqa_real_023` | `science_mc` | Is Rafflesia arnoldii made up of many cells?... | yes | Organism / Kingdom / Cellular Structure / Multicellular? |
| **scienceqa** | `scienceqa_real_024` | `science_mc` | What is the expected ratio of offspring with smooth fruit to offspring... | 4:0 | Parent Alleles / Allele S (Smooth) / Allele S (Smooth) |
| **scienceqa** | `scienceqa_real_025` | `science_mc` | Which of the following could Cooper's test show?... | which design would have the greates | Cooper's Test Parameter / Design Prototype A / Design Prototype B / Measured Evaluation |
| **scienceqa** | `scienceqa_real_026` | `science_mc` | Will these magnets attract or repel each other?... | repel | Magnet Configuration / Left Pole / Right Pole / Interaction |
| **scienceqa** | `scienceqa_real_027` | `science_mc` | What is the capital of Connecticut?... | Hartford | State / Capital City / Location / Marker |
| **scienceqa** | `scienceqa_real_028` | `science_mc` | Which ocean is highlighted?... | the Indian Ocean | Ocean / Geographic Bounds / Highlighted Status / Rank by Area |
| **scienceqa** | `scienceqa_real_029` | `science_mc` | Which statement describes the Yasuni National Park ecosystem?... | It has many different types of orga | National Park / Biome / Location / Biodiversity Characteristic / Key Description |
| **scienceqa** | `scienceqa_real_030` | `science_mc` | Which property do these three objects have in common?... | fragile | Object / Hardness / Malleability / Brittleness / Fragility |
| **scienceqa** | `scienceqa_real_031` | `science_mc` | Look at the models of molecules below. Select the elementary substance... | bromine | Molecule Model / Atomic Composition / Chemical Formula / Identified Substance |
| **scienceqa** | `scienceqa_real_032` | `science_mc` | Select the organism in the same species as the pink-backed pelican.... | Pelecanus rufescens | Organism Candidate / Genus / Species Epithet / Same Species as Pink-backed Pelican (Pelecanus rufescens)? |
| **scienceqa** | `scienceqa_real_033` | `science_mc` | What is the capital of North Dakota?... | Bismarck | State / Capital City / Location / Region / Highlighted Status |
| **scienceqa** | `scienceqa_real_034` | `science_mc` | Identify the question that Jeremiah's experiment can best answer.... | Do cardinals visit feeders containi | Experiment Element / Feeder A (Sunflower) / Feeder B (Flax) / Hypothesis Answered |
| **scienceqa** | `scienceqa_real_035` | `science_mc` | What is the capital of Massachusetts?... | Boston | State / Capital City / Location / Marker Detail |
| **scienceqa** | `scienceqa_real_036` | `science_mc` | Which animal is also adapted to be camouflaged in the snow?... | short-tailed weasel | Animal / Winter Adaptation / Camouflage Habitat / Survival Mechanism |
| **scienceqa** | `scienceqa_real_037` | `science_mc` | Select the organism in the same genus as the Goliath heron.... | Ardea herodias | Organism Candidate / Scientific Name / Genus / Same Genus as Goliath heron (Ardea goliath)? |
| **scienceqa** | `scienceqa_real_038` | `science_mc` | Which country is highlighted?... | Saint Lucia | Island Nation / Island Chain / Sea / Highlighted Marker / Sovereign Status |
| **scienceqa** | `scienceqa_real_039` | `science_mc` | Will these magnets attract or repel each other?... | attract | Magnet Side A / Facing Pole A / Facing Pole B / Magnetic Force Outcome |
| **scienceqa** | `scienceqa_real_040` | `science_mc` | Can Fromia monilis cells make their own food?... | no | Organism / Biological Kingdom / Cellular Nutrition Mode / Can Make Own Food? |
| **scienceqa** | `scienceqa_real_041` | `science_mc` | Does this passage describe the weather or the climate?... | weather | Meteorological Observation / Time Span / Nature / Weather vs Climate Classification |
| **scienceqa** | `scienceqa_real_042` | `science_mc` | Which country is highlighted?... | Nauru | Pacific Nation / Subregion / Coordinates / Highlighted Marker / Geography |
| **scienceqa** | `scienceqa_real_043` | `science_mc` | Which rhetorical appeal is primarily used in this ad?... | pathos (emotion) | Rhetorical Appeal / Core Technique / Ad Element / Primary Appeal Used |
| **scienceqa** | `scienceqa_real_044` | `science_mc` | Which animal is also adapted to be camouflaged among dead leaves?... | Surinam horned frog | Animal / Camouflage Appearance / Habitat Matching / Dead Leaf Adaptation |
| **scienceqa** | `scienceqa_real_045` | `science_mc` | Identify the question that Helen's experiment can best answer.... | Does linen fabric turn darker than  | Helen's Experiment Setup / Bucket 1-5 (Condition A) / Bucket 6-10 (Condition B) / Dependent Variable / Question Answered |
| **scienceqa** | `scienceqa_real_046` | `science_mc` | Think about the magnetic force between the magnets in each pair. Which... | The magnetic force is stronger in P | Magnet Pair / Poles Facing / Distance Between Poles / Magnetic Force Strength |
| **scienceqa** | `scienceqa_real_047` | `science_mc` | What is the capital of Washington?... | Olympia | US State / Capital City / Location / Puget Sound / Map Indication |
| **scienceqa** | `scienceqa_real_048` | `science_mc` | Which solution has a higher concentration of green particles?... | neither; their concentrations are t | Solution Beaker / Green Solute Particles (Count) / Solvent Liquid Volume (mL) / Concentration (Particles / mL) |
| **scienceqa** | `scienceqa_real_049` | `science_mc` | Which is this organism's scientific name?... | Argema mittrei | Naming System / Nomenclature Example / Formatting Rule / Valid Scientific Name |
| **spiqa** | `spiqa_real_000` | `paper_figure` | What are the main differences between the educational philosophies of ... | The Bonaparte school focuses on out | School / Focus & Curriculum / Specialization / Educational Philosophy / Objective |
| **spiqa** | `spiqa_real_001` | `paper_figure` | What is the function of the ReOrth Layer in the Projection Block of th... | The ReOrth Layer re-orthogonalizes  | Block / Layer / Operation / Formula / Function Description |
| **spiqa** | `spiqa_real_002` | `paper_figure` | Which network architecture has the highest accuracy on the CIFAR-10 da... | DMRNet-Wide | Network Architecture / Depth / Params / CIFAR-10 Error (%) / CIFAR-100 Error (%) / SVHN Error (%) |
| **spiqa** | `spiqa_real_003` | `paper_figure` | How does GeoCUTS perform compared to other clusterings for highly acti... | GeoCUTS performs comparably to othe | User Segment / GeoCUTS B-metric / DMA B-metric / Grid B-metric |
| **spiqa** | `spiqa_real_004` | `paper_figure` | Which method performed best according to the P@1 metric for the QA-Exp... | The WeakFG method achieved the high | Method / Agg / QA-Expert P@1 / QA-Expert P@3 / QA-Expert P@5 / QA-Expert MAP / QA-Expert Rprec / Paper-Reviewer P@3 / Paper-Reviewer P@5 / Paper-Reviewer P@10 / Paper-Reviewer MAP / Paper-Reviewer Rprec |
| **spiqa** | `spiqa_real_005` | `paper_figure` | Which system from Ortiz et al. achieved the highest BLEU and METEOR sc... | The SMT system from Ortiz et al. ac | System Source / Model Variant / BLEU Score / METEOR Score |
| **spiqa** | `spiqa_real_006` | `paper_figure` | Which model performed the best on the SICK dataset according to the MS... | The supervised model performed the  | Model Group / Model Name / SICK Pearson r / SICK Spearman rho / SICK MSE / MSRP Accuracy (%) / MSRP F1 (%) |
| **spiqa** | `spiqa_real_007` | `paper_figure` | How does the shape of the IRLS weight function change as the shape par... | The IRLS weight function becomes mo | Shape Parameter alpha / IRLS Weight Curve Profile / Psi Function Curve Profile at z->0 |
| **spiqa** | `spiqa_real_008` | `paper_figure` | During which hours of the day did the most network-related reboots occ... | The most network-related reboots oc | Hour of the Day / Number of Network-Related Reboots |
| **spiqa** | `spiqa_real_009` | `paper_figure` | Which agent values the entire share $Z_j$?... | Agent $j$. | Cake Cutting Component / Visual Symbol / Valuation / Interpretation |
| **spiqa** | `spiqa_real_010` | `paper_figure` | What is the role of the LSTM-MDN network in the training phase?... | The LSTM-MDN network is used to lea | Architecture Phase / Module / Component / Input / Predecessor / Output / Function |
| **spiqa** | `spiqa_real_011` | `paper_figure` | Which policy resulted in the highest average cost?... | MAP Policy | Policy Name / Average Cost / % Episodes Cost 0-20 / % Episodes Cost 20-70 / % Episodes Cost >=70 |
| **spiqa** | `spiqa_real_012` | `paper_figure` | What is the equation that describes the motion of a mass attached to a... | The equation that describes the mot | Physical Concept / Mathematical Expression / Physical Variable / Parameter / Physical Implication |
| **spiqa** | `spiqa_real_013` | `paper_figure` | How does the performance of the Filtering algorithm compare to the per... | The Filtering algorithm performs be | Bayes Net Structure / Algorithm / Error (d_TV) at m=100 / Error (d_TV) at m=500 / Error (d_TV) at m=1000 / Trend Summary |
| **spiqa** | `spiqa_real_014` | `paper_figure` | What are the key differences between Seq2Sick and existing attack meth... | Seq2Sick differs from existing atta | Attack Method / Gradient Based? / Word-level RNN? / Sequential Output? / Targeted Attack Type |
| **spiqa** | `spiqa_real_015` | `paper_figure` | What is the relationship between the true market state qt and the nois... | The noisy version q̂t at time t is  | Trade Time Index (t) / Predecessor Index s(t) / Independent Noise Vector / Cumulative Noise in q_hat_t / Maximum Backwards Jumps |
| **spiqa** | `spiqa_real_016` | `paper_figure` | Which model performed the best on the MSRP task for the Ordered Senten... | SkipThought | Data Split / Model / MSRP (Acc / F1) / MR / CR / SUBJ / MPQA / TREC / Average |
| **spiqa** | `spiqa_real_017` | `paper_figure` | What is the purpose of the residual connection in the decoding module?... | The residual connection allows the  | Stage / Layer Name / Spec / Input Source / Residual Skip Connection Target / Output Resolution / Channel |
| **spiqa** | `spiqa_real_018` | `paper_figure` | How does the observed error compare to the underlying true error as CP... | The observed error is initially hig | CPU Time (seconds) / Observed Error / Underlying True Error / Error Gap (Observed - True) |
| **spiqa** | `spiqa_real_019` | `paper_figure` |  How many negative samples are there in the training set of the CNSE d... | There are approximately 9,719 negat | Dataset Name / Positive Samples / Negative Samples / Training Split / Development Split / Test Split / Total Samples |
