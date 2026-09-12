// School-Safe Profanity Filter Utility
const ProfanityFilter = (() => {
  const BAD_WORDS = [
    'fuck', 'shit', 'bitch', 'asshole', 'bastard', 'cunt', 'dick', 'pussy',
    'cock', 'whore', 'slut', 'fag', 'faggot', 'nigger', 'nigga', 'retard',
    'motherfucker', 'bullshit', 'dipshit', 'jackass', 'dumbass', 'badass',
    'twat', 'wanker', 'prick', 'bollocks', 'blowjob', 'handjob', 'cum',
    'semen', 'tits', 'boobs', 'clit', 'dildo', 'porn', 'hentai', 'anal',
    'nude', 'nudes', 'naked', 'penis', 'vagina', 'chink', 'spic', 'kike',
    'wtf', 'stfu', 'fucker', 'fucking'
  ];

  function clean(text) {
    if (!text || typeof text !== 'string') return '';
    let result = text;
    BAD_WORDS.forEach(bad => {
      const pattern = new RegExp('\\b' + bad.split('').join('[\\W_]*') + '\\b', 'gi');
      result = result.replace(pattern, (match) => '*'.repeat(match.length));
    });
    return result;
  }

  function isClean(text) {
    if (!text || typeof text !== 'string') return true;
    return !BAD_WORDS.some(bad => {
      const pattern = new RegExp('\\b' + bad.split('').join('[\\W_]*') + '\\b', 'i');
      return pattern.test(text);
    });
  }

  return { clean, isClean, BAD_WORDS };
})();
