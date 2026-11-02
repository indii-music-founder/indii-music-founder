# ISSUE-1614: social draft tool boundary — November 2, 2026

The Workflow Lab Social Media branch stopped calling `SocialService.createPost` in merged commit `2823a6345`, but `SocialTools.generate_social_post` still called that method after generating text. It was available to Social, Road, Hospitality, and Generalist agents, and its risk registry listed a write with no approval. `SocialService.createPost` writes to the global in-app `posts` collection and updates social statistics. A request for copy could therefore create a feed post outside the Workflow Lab path.

This branch makes `generate_social_post` return reviewable copy only. Its result explicitly says the draft was not saved or posted; it no longer returns a `postId`. The tool declaration and risk description now state that contract. Scheduling and platform publishing tools remain separate and must keep their own approval gates.

The focused mocked-AI test is a **structural regression check only**. It cannot prove the signed-in Boardroom or Workflow Lab path, deployed behavior, or the absence of a production post. ISSUE-1614 remains partial until a genuine, explicitly draft-only run shows no new global post and an authorized review of the historical QA post is completed. Do not replay the old production workflow solely to make a source-only claim look live.
