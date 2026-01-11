// constants/feedPhrases.ts
import { SpeciesType } from '../types';

export const getSpeciesGrammar = (species: string) => {
    const s = (species || 'poisson').toLowerCase();
    const isFeminine = ['perche', 'truite', 'carpe'].includes(s);
    return {
        article: isFeminine ? 'une' : 'un',
        def: isFeminine ? 'la' : 'le',
        v: isFeminine ? 'validée' : 'validé'
    };
};

export const SARDONIC_PHRASES = {
    skunk: [
        "{avatar} a fait tremper ses leurres pour rien sur ce spot. Pathétique.",
        "{avatar} est revenu du spot avec un grand sourire et zéro poisson.",
        "{avatar} a sauvé les poissons du spot en ne les attrapant pas.",
        "Statistique : 100% de bredouille pour {avatar} sur ce spot.",
        "Bredouille magistrale de {avatar}. L'Oracle est déçu.",
        "{avatar} a validé une session 'Contemplation de la nature'. Zéro prise.",
        "Le spot a gagné, {avatar} a perdu. Encore.",
        "{avatar} a tenté de pêcher. Le spot a poliment décliné l'invitation.",
        "L'Oracle suggère à {avatar} de changer de passion. Ou de spot.",
        "{avatar} est rentré bredouille. Le spot reste invaincu.",
        "Une masterclass de discrétion pour {avatar} : aucun poisson n'a été dérangé.",
        "Le vent, la lune, le courant... {avatar} a déjà préparé ses excuses.",
        "{avatar} a officiellement nourri les poissons du spot sans contrepartie.",
        "Le silence des agneaux ? Non, le silence des leurres de {avatar}.",
        "Zéro. Nada. Nothing. {avatar} est en harmonie avec le vide.",
        "Le spot : 1. {avatar} : 0. La routine s'installe.",
        "{avatar} a fait une belle balade. Ah, il pêchait ? Pardon.",
        "Les poissons du spot remercient {avatar} pour ce moment de calme.",
        "Un grand moment de solitude pour {avatar} au bord de l'eau.",
        "Oracle Info : Le stock de poissons sur le spot est intact après le passage de {avatar}."
    ],
    catch: [
        "{avatar} a humilié {article} {species} de {size}cm sur ce spot.",
        "Enfin ! {avatar} sort {article} {species} de {size}cm.",
        "{avatar} a braqué le spot : {article} {species} de {size}cm au sec.",
        "{article} {species} de {size}cm a eu le malheur de croiser {avatar}.",
        "{avatar} confirme sa chance insolente : {article} {species} de {size}cm.",
        "{avatar} s'énerve : {species} de {size}cm {status} sur ce spot.",
        "{avatar} valide {article} {species} de {size}cm. Le spot est en PLS.",
        "Miracle au bord de l'eau : {avatar} attrape {article} {species} de {size}cm.",
        "Le spot a fini par céder : {article} {species} de {size}cm pour {avatar}.",
        "{avatar} punit le spot avec {article} {species} de {size}cm.",
        "{species} de {size}cm... {avatar} commence à comprendre le métier.",
        "Alerte Prise : {avatar} vient de sécher {article} {species} de {size}cm.",
        "{avatar} fait grimper le score avec {article} {species} de {size}cm.",
        "Hold-up de {avatar} : {article} {species} de {size}cm sorti de nulle part.",
        "Le spot était généreux, {avatar} a pris {article} {species} de {size}cm.",
        "{avatar} fait parler la poudre : {species} de {size}cm.",
        "L'Oracle valide (à contrecoeur) ce {species} de {size}cm pour {avatar}.",
        "{avatar} a trouvé la faille : {article} {species} de {size}cm.",
        "Le compteur s'affole : {species} de {size}cm pour {avatar}.",
        "Propre. Net. Sans bavure. {avatar} sort {article} {species} de {size}cm."
    ],
    fail: [
        "{avatar} a encore ferré dans le vide. Classique sur ce spot.",
        "'C'était un monstre !', jure {avatar} après ce raté monumental.",
        "{avatar} a offert une séance de piercing gratuite à un poisson.",
        "Touche manquée pour {avatar}. Les mains tremblent ?",
        "Décroché ! {avatar} va encore nous raconter des histoires.",
        "Raté magistral. {avatar} devrait vérifier ses hameçons.",
        "Un poisson a dit 'Non' à {avatar} de manière catégorique.",
        "{avatar} a confondu ferrage et gymnastique douce.",
        "{avatar} a été plus lent que le courant. Raté.",
        "Le poisson a testé le leurre de {avatar} et l'a recraché par pitié.",
        "Vibration suspecte, ferrage inutile. {avatar} est au top.",
        "{avatar} vient de rater le poisson de sa vie. Comme d'habitude.",
        "Une touche ? Non, juste les rêves de {avatar} qui s'envolent.",
        "{avatar} a ferré les nuages au-dessus du spot.",
        "La décroche de trop pour {avatar}. Le mental s'effrite.",
        "Le poisson a gagné son duel psychologique contre {avatar}.",
        "Tentative de ferrage non homologuée par l'Oracle pour {avatar}.",
        "{avatar} a failli faire un poisson. Mais non.",
        "Le spot rigole encore du ferrage de {avatar}.",
        "Touche, espoir, déception. Le triptyque habituel de {avatar}."
    ]
};