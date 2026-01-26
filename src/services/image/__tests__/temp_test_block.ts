  describe("captionImage", () => {
    it("should call AI.generateContent with correct structure", async () => {
      const mockResponse = {
        text: vi.fn().mockReturnValue("A glowing orb in a dark forest."),
      };
      (AI.generateContent as unknown as any).mockResolvedValue(mockResponse);

      const result = await ImageGeneration.captionImage(
        { mimeType: "image/png", data: "cleanBase64Data" },
        "subject"
      );

      expect(result).toBe("A glowing orb in a dark forest.");
      const callArgs = (AI.generateContent as unknown as any).mock.calls[0][0];
      expect(callArgs).not.toHaveProperty("config"); 
    });
  });
});
