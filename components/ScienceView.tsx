// components/ScienceView.tsx - Version "Apex Final" v9.8
import React, { useState, useMemo } from 'react';
import { 
  Zap, Thermometer, Waves, Droplets, Eye, 
  Wind, ArrowLeft, BookOpen, Activity, HeartPulse, 
  ShieldCheck, Search, Sparkles, Database, Info, CloudSun,
  Lightbulb, Gauge, Scale, Cloud, Sun, CloudRain, Microscope,
  Settings2, FlaskConical, Compass, Target, BarChart
} from 'lucide-react';

interface ScienceViewProps {
  onBack: () => void;
  isActuallyNight?: boolean;
}

const ScienceView: React.FC<ScienceViewProps> = ({ onBack, isActuallyNight }) => {
  const cardClass = isActuallyNight 
    ? "bg-stone-900/95 border-stone-700 backdrop-blur-2xl shadow-[0_20px_50px_rgba(0,0,0,0.5)]" 
    : "bg-white border-stone-200 shadow-[0_10px_40px_rgba(0,0,0,0.06)]";
  
  const textTitle = isActuallyNight ? "text-white" : "text-stone-900";
  const textBody = isActuallyNight ? "text-stone-200" : "text-stone-800";

  return (
    <div className={`min-h-screen pb-32 px-4 pt-4 animate-oracle-view ${isActuallyNight ? 'bg-[#0c0a09]' : 'bg-[#FDFBF7]'}`}>
      
      {/* --- HEADER PREMIUM --- */}
      <header className="max-w-4xl mx-auto flex items-center justify-between mb-12">
        <div className="flex items-center gap-5">
          <button onClick={onBack} className="p-4 rounded-2xl bg-indigo-600 text-white shadow-xl shadow-indigo-500/30 active:scale-90 transition-all">
            <ArrowLeft size={26} />
          </button>
          <div>
            <h1 className={`text-4xl font-black tracking-tighter uppercase italic ${textTitle}`}>
              Oracle <span className="text-indigo-500 italic">Science</span>
            </h1>
            <p className="text-[10px] font-black text-indigo-500 uppercase tracking-[0.5em] opacity-80 text-left">Intelligence Halieutique de Pointe</p>
          </div>
        </div>
        <ShieldCheck size={48} className="text-indigo-500/20 hidden sm:block" />
      </header>

      <div className="max-w-4xl mx-auto space-y-20">
        
        {/* --- SECTION MARKETING : LE JUMEAU NUMÉRIQUE --- */}
        <section className="relative text-center space-y-8">
          <div className="inline-block p-5 rounded-3xl bg-indigo-500/10 text-indigo-500 mb-2 rotate-3">
            <Sparkles size={36} />
          </div>
          <h2 className={`text-4xl font-black tracking-tight ${textTitle} max-w-xl mx-auto leading-[1.1]`}>
            Le parfait partenaire pour le pêcheur moderne
          </h2>
          <p className={`text-lg leading-relaxed max-w-2xl mx-auto ${textBody}`}>
             Oubliez les simples prévisions météo. Oracle Fish crée un <strong>Jumeau Numérique</strong> de votre secteur. Grâce au moteur Zero-Hydro, nous transformons le ciel en données subaquatiques sans aucun capteur physique.
          </p>
        </section>

        {/* --- SECTION 1 : LES 10 PILIERS DE L'ANALYSE --- */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 text-indigo-500 font-black uppercase tracking-tighter text-xl">
            <BarChart size={28} /> <h2>1. Les 10 Vérités de l'Oracle</h2>
          </div>
          <div className={`p-10 rounded-[3rem] border ${cardClass}`}>
            <p className="text-base mb-10 leading-relaxed font-bold border-b border-indigo-500/10 pb-6">
              Oracle fusionne les relevés atmosphériques haute-résolution avec des simulations thermodynamiques pour recréer l'invisible sous la surface.
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12 gap-y-8">
              <DataStat icon={<Sun />} label="Solaire (Réel)" type="Mesuré" desc="L'angle et l'intensité des UV qui déclenchent les pics d'activité métabolique." />
              <DataStat icon={<Thermometer />} label="Temp. Air (Réel)" type="Mesuré" desc="Source d'énergie thermique qui chauffe ou refroidit la pellicule d'eau." />
              <DataStat icon={<Gauge />} label="Pression (Réel)" type="Mesuré" desc="La force de l'air agissant sur la vessie natatoire des poissons." />
              <DataStat icon={<CloudRain />} label="Pluie (Réel)" type="Mesuré" desc="Apport de sédiments et de nourriture par lessivage des sols." />
              <DataStat icon={<Wind />} label="Vent (Réel)" type="Mesuré" desc="Moteur du brassage mécanique et de l'oxygénation de surface." />
              <DataStat icon={<Cloud />} label="Nuages (Réel)" type="Mesuré" desc="Filtrage photonique déterminant la luminosité disponible au fond." />
              <DataStat icon={<Activity />} label="Temp. Eau (Simulé)" type="Estimé" desc="Calculée via le modèle de relaxation Air2Water sur un historique de 45 jours." />
              <DataStat icon={<Waves />} label="Turbidité (Simulé)" type="Estimé" desc="Simulation de la clarté par accumulation pluviale et Loi de Stokes." />
              <DataStat icon={<Droplets />} label="Oxygène (Simulé)" type="Estimé" desc="Calcul de saturation via Benson & Krause ajusté par la pression atmosphérique." />
              <DataStat icon={<Target />} label="RD Index (Simulé)" type="Estimé" desc="Indice de Distance de Réaction calculé selon l'acuité visuelle de l'espèce." />
            </div>
          </div>
        </section>

        {/* --- SECTION 2 : PHYSIQUE DU MILIEU (VISUALISATION HAUTE PRÉCISION) --- */}
        <section className="space-y-10">
          <div className="flex items-center gap-3 text-orange-600 font-black uppercase tracking-tighter text-xl">
            <Activity size={28} /> <h2>2. La Physique du Milieu</h2>
          </div>
          
          <div className={`p-10 rounded-[3rem] border ${cardClass}`}>
            <h3 className={`text-2xl font-black mb-6 ${textTitle}`}>L'Inertie : Pourquoi l'eau est "fainéante" ?</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6 text-left">
                    <p className={`text-base leading-relaxed italic border-l-4 border-indigo-500 pl-6 py-2 ${textBody}`}>
                      "L'eau ne change pas de température instantanément. Elle possède une mémoire thermique que l'Oracle décode via le coefficient τ (tau)."
                    </p>
                    <div className={`space-y-4 text-sm leading-relaxed ${textBody}`}>
                      <p>
                        Ton moteur <strong>Zero-Hydro</strong> adapte ses calculs selon le type de milieu pour coller à la réalité physique du spot :
                      </p>
                      <ul className="space-y-3">
                        <li className="flex gap-3">
                          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-indigo-500 shrink-0" />
                          <span><strong>Milieu Lotique (Rivière) :</strong> Le brassage constant et le faible volume rendent l'eau plus réactive. (Inertie τ ≈ 14h).</span>
                        </li>
                        <li className="flex gap-3">
                          <div className="mt-1 w-1.5 h-1.5 rounded-full bg-cyan-500 shrink-0" />
                          <span><strong>Milieu Lentique (Lac / Étang) :</strong> La masse d'eau stable crée un "effet tampon" massif. Le changement est très lent (Inertie τ &gt; 28h).</span>
                        </li>
                      </ul>
                    </div>
                </div>

                {/* VISUALISATION BLUEPRINT : HAUT CONTRASTE & FONDS CLAIR */}
                <div className="bg-slate-50 p-6 rounded-[2.5rem] shadow-inner border border-slate-200 relative overflow-hidden h-72 flex flex-col justify-between">
                    {/* Motif de grille Blueprint */}
                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#4f46e5 0.5px, transparent 0.5px)', backgroundSize: '12px 12px' }}></div>
                    
                    <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2 relative z-10">
                        <span className="flex items-center gap-1 text-indigo-600"><Compass size={10}/> Comparatif d'Inertie Thermique</span>
                        <span className="text-slate-300">Sim. v8.8.1</span>
                    </div>

                    <div className="relative flex-1 flex items-center justify-center z-10">
                        {/* Courbes SVG */}
                        <svg className="absolute inset-0 w-full h-full p-2" viewBox="0 0 400 100" preserveAspectRatio="none">
                           {/* Temp Air : Référence (Pointillés Ambre) */}
                           <path
                             d="M0,80 L40,20 L80,90 L120,30 L160,85 L200,40 L240,95 L280,25 L320,70 L360,40 L400,60"
                             fill="none"
                             stroke="#f59e0b"
                             strokeWidth="1.5"
                             strokeDasharray="4,4"
                             className="opacity-40"
                           />
                           
                           {/* Temp Eau RIVIÈRE : Réactive (Indigo) */}
                           <path
                             d="M0,75 C40,75 60,35 100,45 C140,55 180,45 220,55 C260,65 300,45 340,55 C380,65 400,60 400,60"
                             fill="none"
                             stroke="#4f46e5"
                             strokeWidth="3"
                             strokeLinecap="round"
                             className="opacity-80"
                           />

                           {/* Temp Eau LAC : Stabilité maximale (Cyan) */}
                           <path
                             d="M0,70 C100,70 200,62 300,65 C350,66 400,64 400,64"
                             fill="none"
                             stroke="#0891b2"
                             strokeWidth="4"
                             strokeLinecap="round"
                             className="drop-shadow-sm"
                           />
                        </svg>
                    </div>

                    {/* Légende Scientifique */}
                    <div className="grid grid-cols-3 gap-2 pt-4 border-t border-slate-200 relative z-10">
                        <div className="flex flex-col items-center">
                            <div className="w-6 h-1 bg-amber-400 mb-1 border border-amber-500/20 border-dashed"></div>
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Air (Instable)</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-6 h-1 bg-indigo-500 mb-1 rounded-full"></div>
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Rivière (τ 14h)</span>
                        </div>
                        <div className="flex flex-col items-center">
                            <div className="w-6 h-1 bg-cyan-600 mb-1 rounded-full shadow-sm"></div>
                            <span className="text-[7px] font-black text-slate-500 uppercase tracking-tighter">Grand Lac (τ 30h)</span>
                        </div>
                    </div>
                </div>
            </div>
          </div>
        </section>

        {/* --- SECTION 3 : LE LABORATOIRE SIMULATEUR --- */}
        <section className="space-y-8">
          <div className="flex items-center gap-3 text-indigo-500 font-black uppercase tracking-tighter text-xl">
            <Microscope size={28} /> <h2>3. Le Laboratoire Oracle</h2>
          </div>

          <div className={`p-8 rounded-[2.5rem] border ${cardClass} relative overflow-hidden`}>
            {/* Michael : Blocs explicatifs resserrés */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8 pb-8 border-b border-indigo-500/10 text-left">
                <div className="space-y-2">
                    <h4 className="font-black uppercase text-[10px] text-indigo-500 tracking-widest">Méthode Cold-Start (45 Jours)</h4>
                    <p className={`text-[11px] leading-relaxed ${textBody}`}>
                        Oracle rejoue les 1080 dernières heures de météo pour garantir que le modèle thermique a parfaitement convergé vers la réalité du terrain.
                    </p>
                </div>
                <div className="space-y-2">
                    <h4 className="font-black uppercase text-[10px] text-indigo-500 tracking-widest">Saturation (Michaelis-Menten)</h4>
                    <p className={`text-[11px] leading-relaxed ${textBody}`}>
                        Le BioScore croise la lumière LUX et la turbidité pour simuler la visibilité réelle. Chaque espèce possède son propre seuil de performance.
                    </p>
                </div>
            </div>
            
            <BioScoreLab isActuallyNight={isActuallyNight} />
          </div>
        </section>
        <section className="space-y-12">
          <div className="flex items-center gap-4">
             <div className="h-px flex-1 bg-emerald-500/20"></div>
             <div className="flex items-center gap-3 text-emerald-500 font-black uppercase tracking-tighter text-xl bg-emerald-500/5 px-8 py-3 rounded-full border border-emerald-500/10">
               <HeartPulse size={28} /> <h2>3. L'Intelligence Biologique</h2>
             </div>
             <div className="h-px flex-1 bg-emerald-500/20"></div>
          </div>

          <div className="grid grid-cols-1 gap-8">
            {/* CARTE : MÉTABOLISME & LIEBIG */}
            <div className={`p-10 rounded-[3rem] border ${cardClass} relative overflow-hidden group`}>
              <div className="absolute -right-8 -top-8 text-emerald-500/5 rotate-12 group-hover:rotate-45 transition-transform duration-1000">
                <Scale size={160} />
              </div>
              <h3 className={`text-2xl font-black mb-6 ${textTitle} flex items-center gap-3`}>
                La Loi de Liebig : Le Maillon Faible
              </h3>
              <p className={`text-base leading-relaxed ${textBody}`}>
                Pourquoi un score chute-t-il alors que la température est parfaite ? C'est la <strong>Loi de Liebig</strong> (loi du minimum). Pour un poisson, la survie n'est pas une moyenne, mais une limite. Si l'<strong>Oxygène Dissous</strong> vient à manquer en plein été, peu importe que la <strong>Photopériode</strong> soit idéale : le métabolisme passe en mode survie. Oracle identifie ce "facteur limitant" pour prédire les phases d'apathie totale.
              </p>
            </div>

            {/* GRID DES PROFILS SPÉCIFIQUES */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              
              {/* LE SANDRE : SENSIBILITÉ PHYSOCLISTE */}
              <div className={`p-8 rounded-[2.5rem] border ${cardClass} space-y-4`}>
                <div className="flex justify-between items-start">
                  <h4 className="text-xl font-black uppercase text-amber-500 italic">Le Sandre</h4>
                  <div className="p-2 rounded-xl bg-amber-500/10 text-amber-500"><Eye size={20}/></div>
                </div>
                <p className={`text-sm leading-relaxed ${textBody}`}>
                  Doté d'un <strong>Tapetum Lucidum</strong>, il amplifie les rares <strong>LUX</strong> des profondeurs. Mais son "talon d'Achille" est sa nature de <strong>Physocliste</strong> : sa <strong>Vessie Natatoire</strong> ne peut pas se vider instantanément. 
                  <br /><br />
                  Une chute de pression le rend inconfortable, le forçant souvent à s'écraser au fond. Oracle ajuste son BioScore en fonction de cette inertie gazeuse interne.
                </p>
                <div className="pt-4 border-t border-indigo-500/5 text-[10px] font-bold uppercase text-stone-500 tracking-widest">
                  Adaptation : Vision Scotopique & Baro-sensible
                </div>
              </div>

              {/* LE BROCHET : L'AGILITÉ PHYSOSTOME */}
              <div className={`p-8 rounded-[2.5rem] border ${cardClass} space-y-4`}>
                <div className="flex justify-between items-start">
                  <h4 className="text-xl font-black uppercase text-green-600 italic">Le Brochet</h4>
                  <div className="p-2 rounded-xl bg-green-500/10 text-green-600"><Zap size={20}/></div>
                </div>
                <p className={`text-sm leading-relaxed ${textBody}`}>
                  Prédateur visuel, il exige un <strong>RD Index</strong> élevé. Contrairement au Sandre, c'est un <strong>Physostome</strong> : il peut équilibrer sa pression interne instantanément. 
                  <br /><br />
                  Cela lui permet d'être en pleine possession de ses moyens lors des baisses de <strong>Pression Atmosphérique</strong> pré-frontales, là où ses proies sont désorientées. Oracle booste son activité lors de ces déclics barométriques rapides.
                </p>
                <div className="pt-4 border-t border-indigo-500/5 text-[10px] font-bold uppercase text-stone-500 tracking-widest">
                  Adaptation : Agilité Barométrique & Chasseur à Vue
                </div>
              </div>

              {/* LE BLACK-BASS : THERMOGRAPHIE TACTIQUE */}
              <div className={`p-8 rounded-[2.5rem] border ${cardClass} space-y-4`}>
                <div className="flex justify-between items-start">
                  <h4 className="text-xl font-black uppercase text-indigo-500 italic">Le Black-Bass</h4>
                  <div className="p-2 rounded-xl bg-indigo-500/10 text-indigo-500"><Thermometer size={20}/></div>
                </div>
                <p className={`text-sm leading-relaxed ${textBody}`}>
                  Le champion de la <strong>Photopériode</strong>. Son activité est un curseur thermique ultra-précis. Il est l'espèce la plus punie par le "Post-Frontal Blues" : une hausse de pression avec ciel clair (Haut <strong>LUX</strong>) après une pluie froide bloque son agressivité. 
                  <br /><br />
                  Oracle surveille la stabilité de la colonne d'eau dans les milieux <strong>Lentiques</strong> pour prédire sa sortie de léthargie.
                </p>
                <div className="pt-4 border-t border-indigo-500/5 text-[10px] font-bold uppercase text-stone-500 tracking-widest">
                  Adaptation : Métabolisme Thermodépendant
                </div>
              </div>

              {/* LA PERCHE : ÉQUILIBRE OXYGÉNÉ */}
              <div className={`p-8 rounded-[2.5rem] border ${cardClass} space-y-4`}>
                <div className="flex justify-between items-start">
                  <h4 className="text-xl font-black uppercase text-purple-500 italic">La Perche</h4>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-500"><Droplets size={20}/></div>
                </div>
                <p className={`text-sm leading-relaxed ${textBody}`}>
                  Comme le Sandre, c'est une <strong>Physocliste</strong> sensible. Son activité grégaire demande une énergie immense et donc un taux d'<strong>Oxygène Dissous</strong> optimal. 
                  <br /><br />
                  En milieu <strong>Lotique</strong>, elle utilise le brassage du vent pour s'activer. Oracle favorise son score lors des transitions lumineuses, maximisant son avantage visuel sur le poisson fourrage.
                </p>
                <div className="pt-4 border-t border-indigo-500/5 text-[10px] font-bold uppercase text-stone-500 tracking-widest">
                  Adaptation : Opportunisme & Baromètre d'Oxygène
                </div>
              </div>

            </div>
          </div>
        </section>
        {/* --- SECTION 4 : ENCYCLOPÉDIE DE LUXE --- */}
        <section className="space-y-10 pb-20">
          <div className="flex items-center gap-4">
             <div className="h-px flex-1 bg-indigo-500/20"></div>
             <div className="flex items-center gap-3 text-indigo-500 font-black uppercase tracking-tighter text-xl bg-indigo-500/5 px-8 py-3 rounded-full border border-indigo-500/10">
               <BookOpen size={28} /> <h2>Encyclopédie Halieutique</h2>
             </div>
             <div className="h-px flex-1 bg-indigo-500/20"></div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <GlossaryTerm icon={<Waves/>} term="NTU (Turbidité)" def="Unité mesurant le trouble de l'eau. 0 = Cristallin, 30+ = Chocolat. Indispensable pour calibrer la couleur et le type de vibrations (silencieux vs bruiteur)." />
            
            <GlossaryTerm icon={<Compass/>} term="Lentique / Lotique" def="Distingue les eaux stagnantes (Lacs) des eaux courantes (Rivières). Cette distinction modifie radicalement le coefficient de rappel thermique de l'Oracle." />
            
            <GlossaryTerm icon={<Gauge/>} term="Vessie Natatoire" def="Organe de flottaison. Son volume varie avec la pression. Les poissons adaptent leur profondeur ou leur activité selon la vitesse de cette variation gazeuse." />

            <GlossaryTerm icon={<Zap/>} term="Physocliste" def="Poissons (Sandre, Perche, Bass) dont la vessie n'est pas reliée à l'œsophage. Ils équilibrent leur pression lentement par le sang, les rendant sensibles aux fronts brutaux." />

            <GlossaryTerm icon={<Activity/>} term="Physostome" def="Poissons (Brochet, Truite) possédant un canal pneumatique. Ils peuvent décompresser instantanément, leur offrant une agilité barométrique supérieure lors des chutes de pression." />

            <GlossaryTerm icon={<Droplets/>} term="Oxygène Dissous" def="Gaz vital dont le taux chute drastiquement au-delà de 22°C. Oracle simule le brassage mécanique du vent pour calculer les bonus de réaération." />
            
            <GlossaryTerm icon={<Eye/>} term="Tapetum Lucidum" def="Couche miroir amplifiant la lumière chez le Sandre. Elle permet une chasse efficace là où les LUX sont trop faibles pour les autres prédateurs." />
            
            <GlossaryTerm icon={<Lightbulb/>} term="LUX (Irradiance)" def="Intensité lumineuse atteignant la surface. Elle est le carburant de la vision et détermine le 'RD Index' (distance de réaction) calculé par le moteur." />

            <GlossaryTerm icon={<FlaskConical/>} term="Michaelis-Menten" def="Modèle mathématique de saturation utilisé par l'Oracle pour simuler comment la vision d'un poisson plafonne ou s'effondre selon la clarté de l'eau." />

            <GlossaryTerm icon={<Microscope/>} term="Modèle d'Euler" def="Algorithme de calcul utilisé pour la relaxation thermique. Il permet de simuler le 'retard' de l'eau sur l'air, indispensable pour éviter les erreurs de température." />

            <GlossaryTerm icon={<Target/>} term="RD Index" def="Reactive Distance Index. Calculé en temps réel, il définit la portée maximale (en mètres) à laquelle un poisson peut détecter visuellement votre leurre." />
            
            <GlossaryTerm icon={<Database/>} term="Cold-Start" def="Processus d'initialisation sur 45 jours. Oracle 'rejoue' l'histoire météo récente pour s'assurer que le modèle physique colle parfaitement à la réalité du terrain." />
            
            <GlossaryTerm icon={<Sun/>} term="Photopériode" def="Durée d'ensoleillement quotidien. Elle influence les cycles hormonaux et les pics d'agressivité saisonniers (ex: frénésie pré-hivernale)." />

            <GlossaryTerm icon={<CloudSun/>} term="Post-Frontal Blues" def="Phénomène de léthargie observé après un front froid, quand le ciel s'éclaircit brutalement et que la pression remonte. Très punitif pour le Black-Bass." />
            
            <GlossaryTerm icon={<HeartPulse/>} term="Veto Éthique" def="Mécanisme de protection : le BioScore chute à 5/100 si l'eau dépasse 24.5°C pour décourager la pêche et limiter la mortalité post-combat." />
            
            <GlossaryTerm icon={<Scale/>} term="Loi de Liebig" def="Loi du maillon faible : si un seul paramètre est critique (ex: manque d'O2), le score global s'effondre, même si les autres conditions sont parfaites." />
          </div>
        </section>

        <footer className="py-24 text-center opacity-40 flex flex-col items-center gap-3">
           <div className="h-px w-32 bg-indigo-500"></div>
           <p className="text-[11px] font-black uppercase tracking-[0.6em] text-indigo-500">
             Oracle Fish Engineering - Nullius in Verba
           </p>
        </footer>
      </div>
    </div>
  );
};

// --- COMPOSANT SIMULATEUR ---
const BioScoreLab = ({ isActuallyNight }: { isActuallyNight?: boolean }) => {
    const [species, setSpecies] = useState<'sandre' | 'brochet' | 'perche' | 'blackbass'>('brochet');
    const [temp, setTemp] = useState(18.5);
    const [ntu, setNtu] = useState(8.2);
    const [oxy, setOxy] = useState(8.8);

    const score = useMemo(() => {
        const profiles: any = {
            sandre: { tRef: 22, tSigma: 4.5, kNTU: 0.02 },
            brochet: { tRef: 18, tSigma: 6.0, kNTU: 0.06 },
            perche: { tRef: 21, tSigma: 6.5, kNTU: 0.035 },
            blackbass: { tRef: 26, tSigma: 7.5, kNTU: 0.045 }
        };
        const p = profiles[species];
        let sigma = p.tSigma;
        if (temp < p.tRef) sigma *= 1.4; 
        const si_temp = Math.exp(-0.5 * Math.pow((temp - p.tRef) / sigma, 2));
        const visual = Math.exp(-p.kNTU * ntu); 
        const oxy_threshold = species === 'sandre' ? 5.5 : 4.5;
        let si_oxy = 1.0;
        if (oxy < oxy_threshold) si_oxy = Math.max(0.1, 1 - (oxy_threshold - oxy) / 2.5);
        if (species === 'brochet' && temp > 23.5) return 5;
        if (temp < 6) return 10;
        let res = 100 * si_temp * visual * si_oxy * 1.25;
        if (res > 85) res = 85 + (15 * (1 - Math.exp(-(res - 85) / 12))); 
        return Math.round(Math.min(100, res));
    }, [species, temp, ntu, oxy]);

    const labCardClass = isActuallyNight ? "bg-black border-indigo-500/20 shadow-inner" : "bg-stone-50 border-stone-200 shadow-inner";

    return (
        <div className={`p-8 rounded-[3.5rem] border ${labCardClass}`}>
            <div className="flex flex-col lg:flex-row gap-16">
                <div className="flex-1 space-y-10">
                    <div className="flex items-center gap-3 border-b border-indigo-500/10 pb-4">
                        <Settings2 size={20} className="text-indigo-500"/>
                        <h4 className="text-xs font-black uppercase tracking-[0.3em] text-stone-500 text-left">Variables de Simulation</h4>
                    </div>
                    <div className="space-y-8">
                        <LabSlider label="Température Eau" value={temp} unit="°C" min={4} max={32} onChange={setTemp} />
                        <LabSlider label="Turbidité (Clarté)" value={ntu} unit="NTU" min={0} max={45} onChange={setNtu} />
                        <LabSlider label="Oxygène Dissous" value={oxy} unit="mg/L" min={1} max={14} onChange={setOxy} />
                    </div>
                </div>

                <div className="flex-1 flex flex-col items-center justify-center p-10 rounded-[3rem] bg-indigo-600/5 border border-indigo-500/10 relative overflow-hidden shadow-2xl">
                    <div className="absolute top-0 right-0 p-6 opacity-5 rotate-12"><FlaskConical size={100}/></div>
                    <div className="flex flex-wrap justify-center gap-2 mb-10 bg-black/30 p-2 rounded-2xl border border-white/5 relative z-10">
                        {['sandre', 'brochet', 'perche', 'blackbass'].map(s => (
                            <button key={s} onClick={() => setSpecies(s as any)} className={`px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-tighter transition-all ${species === s ? 'bg-indigo-600 text-white shadow-lg scale-105 border border-indigo-400' : 'text-stone-400 hover:text-stone-200 hover:bg-white/5'}`}>{s}</button>
                        ))}
                    </div>
                    <div className="relative mb-6 z-10">
                        <svg className="w-56 h-56 transform -rotate-90">
                            <circle cx="112" cy="112" r="100" stroke="currentColor" strokeWidth="16" fill="transparent" className="text-indigo-500/10" />
                            <circle cx="112" cy="112" r="100" stroke="currentColor" strokeWidth="16" fill="transparent" strokeDasharray={628} strokeDashoffset={628 - (628 * score) / 100} strokeLinecap="round" className="text-indigo-500 transition-all duration-1000 ease-out shadow-[0_0_20px_rgba(99,102,241,0.5)]" />
                        </svg>
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                            <span className={`text-6xl font-black tracking-tighter ${isActuallyNight ? 'text-white' : 'text-stone-900'}`}>{score}</span>
                            <span className="text-xs font-black uppercase tracking-[0.4em] opacity-40 mt-1">Score Bio</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- SOUS-COMPOSANTS ---

const DataStat = ({ icon, label, type, desc }: any) => (
  <div className="flex gap-4 group">
    <div className="p-3 h-fit rounded-2xl bg-indigo-500/10 text-indigo-500 group-hover:bg-indigo-500 group-hover:text-white transition-all duration-300 shadow-sm border border-indigo-500/10">
      {icon}
    </div>
    <div className="space-y-1 text-left">
      <div className="flex items-center gap-2">
        <span className="font-black text-sm uppercase tracking-tight">{label}</span>
        <span className={`text-[8px] font-black px-1.5 py-0.5 rounded uppercase border ${type === 'Mesuré' ? 'border-emerald-500 text-emerald-500 bg-emerald-500/5 shadow-[0_0_10px_rgba(16,185,129,0.1)]' : 'border-amber-500 text-amber-500 bg-amber-500/5 shadow-[0_0_10px_rgba(245,158,11,0.1)]'}`}>{type}</span>
      </div>
      <p className="text-[11px] leading-relaxed opacity-80 font-medium">{desc}</p>
    </div>
  </div>
);

const LabSlider = ({ label, value, unit, min, max, onChange }: any) => (
    <div className="space-y-4">
        <div className="flex justify-between items-end">
            <span className="text-[10px] font-black text-stone-500 uppercase tracking-[0.2em] text-left">{label}</span>
            <span className="text-base font-black text-indigo-500 font-mono shadow-sm px-3 py-1 bg-indigo-500/5 rounded-lg border border-indigo-500/10">{value}{unit}</span>
        </div>
        <input type="range" min={min} max={max} step={0.1} value={value} onChange={(e) => onChange(parseFloat(e.target.value))} className="w-full h-2 bg-stone-800 rounded-lg appearance-none cursor-pointer accent-indigo-500" />
    </div>
);

const GlossaryTerm = ({ icon, term, def }: any) => (
  <div className="p-8 rounded-[2.5rem] bg-indigo-500/[0.03] border border-indigo-500/10 hover:border-indigo-500/40 transition-all duration-500 group shadow-sm text-left">
    <div className="flex items-center gap-4 mb-4 text-indigo-500 font-black uppercase text-sm tracking-widest">
      <div className="p-3 rounded-2xl bg-indigo-500/10 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-inner">{icon}</div>
      {term}
    </div>
    <p className="text-[12px] mt-1 leading-relaxed opacity-90 text-stone-400 font-semibold">{def}</p>
  </div>
);

const FeatureCard = ({ icon, title, desc }: any) => (
  <div className="space-y-4 p-8 rounded-[2.5rem] bg-indigo-500/5 border border-indigo-500/10 hover:border-indigo-500/30 transition-all duration-500 group text-left">
    <div className="p-4 w-fit rounded-2xl bg-white dark:bg-stone-900 shadow-lg group-hover:scale-110 transition-transform">{icon}</div>
    <h3 className="font-black uppercase text-xs tracking-[0.2em] text-indigo-500">{title}</h3>
    <p className="text-[11px] leading-relaxed font-bold opacity-80">{desc}</p>
  </div>
);

export default ScienceView;