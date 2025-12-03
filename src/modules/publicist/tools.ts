import { AI } from '../../services/ai/AIService';

export const PUBLICIST_TOOLS = {
    write_press_release: async (args: { headline: string, company_name: string, key_points: string[], contact_info: string }) => {
        const prompt = `
        You are a Senior Publicist.
        Write a formal press release.
<<<<<<< HEAD
        
=======

>>>>>>> fix/functions-indexeddb-googlemaps-1
        Headline: ${args.headline}
        Company: ${args.company_name}
        Key Points:
        ${args.key_points.map(p => `- ${p}`).join('\n')}
        Contact Info: ${args.contact_info}
<<<<<<< HEAD
        
=======

>>>>>>> fix/functions-indexeddb-googlemaps-1
        Format: Standard Press Release format (FOR IMMEDIATE RELEASE).
        Tone: Professional, exciting, newsworthy.
        `;

        try {
            const res = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to generate press release.";
        } catch (e) {
            return "Error generating press release.";
        }
    },

    generate_crisis_response: async (args: { issue: string, sentiment: string, platform: string }) => {
        const prompt = `
        You are a Crisis Management Expert.
        Draft a response to a negative situation.
<<<<<<< HEAD
        
        Issue: ${args.issue}
        Current Sentiment: ${args.sentiment}
        Platform: ${args.platform}
        
=======

        Issue: ${args.issue}
        Current Sentiment: ${args.sentiment}
        Platform: ${args.platform}

>>>>>>> fix/functions-indexeddb-googlemaps-1
        Goal: De-escalate, show empathy, and provide a solution or next step.
        Tone: Empathetic, professional, calm.
        `;

        try {
            const res = await AI.generateContent({
                model: 'gemini-3-pro-preview',
                contents: { role: 'user', parts: [{ text: prompt }] }
            });
            return res.text() || "Failed to generate crisis response.";
        } catch (e) {
            return "Error generating crisis response.";
        }
    }
};
