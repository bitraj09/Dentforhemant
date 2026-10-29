DELETE FROM `SystemConfig` WHERE `key` = 'llm.gemini.apiKey';
UPDATE `SystemConfig` SET `value` = 'OWN_AI' WHERE `key` = 'activeModel' AND `value` <> 'OWN_AI';
