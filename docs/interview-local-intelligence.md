# Local interview intelligence

The interview state machine remains `QUESTION → ANSWER → ANALYZE → FOLLOW_UP_DECISION → FOLLOW_UP | NEXT_TOPIC`. Its scoring and follow-up decisions now come from `ai-service/app/interview_ai`, never from a hosted generative provider.

| Dependency | Purpose | Runs locally | Internet required at interview time | Per-request cost |
| --- | --- | --- | --- | --- |
| Python regex and dictionaries | skills, STAR, personal contribution, results | Yes | No | No |
| scikit-learn | TF-IDF and cosine fallback | Yes | No | No |
| spaCy | optional tokenisation / entity support | Yes | No after model installation | No |
| sentence-transformers + torch | multilingual local semantic similarity | Yes | No; only a pre-cached model is loaded | No |
| faster-whisper | optional local speech-to-text | Yes | No after model installation | No |
| Silero VAD | optional local voice activity detection | Yes | No after model installation | No |
| MediaPipe | optional local camera/environment signals | Yes | No after model installation | No |
| Ollama | optional local wording only | Yes | No after local model installation | No |

The deterministic path is complete without Ollama, speech-to-text, VAD, camera analysis, or any external API.
# Local hybrid relevance

EasyJob evaluates interview answers locally. It does not send candidate answers to a hosted model, paid API, Ollama, or any other generative provider.

The setup/deployment step runs `python -m scripts.cache_interview_models` from `ai-service`. It caches `sentence-transformers/paraphrase-multilingual-MiniLM-L12-v2` locally. At runtime the service opens the model with `local_files_only=True`; it cannot download or call hosted inference during an interview.

On startup, the service preloads TF-IDF and the local embedding model. `GET /health/ready` returns `ready` only after both resources are loaded. If the embedding model is missing or cannot load, candidate analysis remains available with TF-IDF and deterministic rules, reports `analysis_engine: local_deterministic_fallback`, and readiness is degraded. A loaded model reports `analysis_engine: local_hybrid`.

The chosen relevance combination is 10% TF-IDF, 65% multilingual embedding similarity, and 25% required-skill coverage. The benchmark showed that this keeps lexical evidence and explicit skills in the score while substantially separating paraphrases from off-topic text. Specificity, STAR evidence, personal contribution, result detection, and communication metrics remain separate signals and can independently trigger a follow-up.
