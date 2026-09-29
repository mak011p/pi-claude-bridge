import * as piAi from "@earendil-works/pi-ai";
import type { Context, Tool } from "@earendil-works/pi-ai";

interface TranscriptHelpers {
	normalizeContext?: (context: Context) => { messages: Context["messages"] };
	getCurrentSystemPrompt?: (messages: Context["messages"]) => string;
	getCurrentTools?: (messages: Context["messages"]) => Tool[];
}

/** Project Pi 0.87's transcript into the bridge's prompt/tool/session inputs.
 * Older Pi versions still pass top-level fields; keep that path unchanged. */
export function projectProviderContext(context: Context): Context {
	const isSystem = (message: { role: string }) => message.role === "system";
	if (!context.messages.some(isSystem)) return context;
	const { normalizeContext, getCurrentSystemPrompt, getCurrentTools } = piAi as TranscriptHelpers;
	if (!normalizeContext || !getCurrentSystemPrompt || !getCurrentTools) {
		throw new Error("Claude bridge cannot read this Pi transcript: system-message helpers are unavailable");
	}
	const { messages } = normalizeContext(context);
	return {
		systemPrompt: getCurrentSystemPrompt(messages),
		tools: getCurrentTools(messages),
		// Claude receives system instructions separately. Excluding these entries
		// also keeps session cursors independent of prompt/tool patch messages.
		messages: messages.filter((message) => !isSystem(message)),
	};
}
