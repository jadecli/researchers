<?php

declare(strict_types=1);

namespace Researchers\Extractors;

/**
 * Matches SKILL.md and plugin.json patterns in documentation content.
 */
class SkillPatternMatcher
{
    /**
     * @return array<array{name: string, description: string, type: string, content: string}>
     */
    public function match(string $content): array
    {
        $skills = [];

        // Match YAML frontmatter blocks
        $frontmatterSkills = $this->matchFrontmatter($content);
        $skills = array_merge($skills, $frontmatterSkills);

        // Match SKILL.md heading patterns
        $headingSkills = $this->matchSkillHeadings($content);
        $skills = array_merge($skills, $headingSkills);

        // Match plugin.json code blocks
        $pluginSkills = $this->matchPluginJson($content);
        $skills = array_merge($skills, $pluginSkills);

        // Deduplicate by name
        $seen = [];
        $unique = [];
        foreach ($skills as $skill) {
            if (!isset($seen[$skill['name']])) {
                $seen[$skill['name']] = true;
                $unique[] = $skill;
            }
        }

        return $unique;
    }

    /**
     * @return array<array{name: string, description: string, type: string, content: string}>
     */
    private function matchFrontmatter(string $content): array
    {
        $skills = [];

        if (preg_match('/^---\s*\n(.*?)\n---\s*\n(.*)/s', $content, $match)) {
            $frontmatter = $this->parseSimpleYaml($match[1]);
            $body = trim($match[2]);

            $name = $frontmatter['name'] ?? '';
            if ($name !== '') {
                $skills[] = [
                    'name' => (string) $name,
                    'description' => (string) ($frontmatter['description'] ?? ''),
                    'type' => 'frontmatter',
                    'content' => $body,
                ];
            }
        }

        return $skills;
    }

    /**
     * @return array<array{name: string, description: string, type: string, content: string}>
     */
    private function matchSkillHeadings(string $content): array
    {
        $skills = [];

        if (preg_match_all('/(?:^|\n)#\s+(?:SKILL|Skill)[:\s]+(\S+)\s*\n(.*?)(?=\n#\s|\z)/s', $content, $matches, PREG_SET_ORDER)) {
            foreach ($matches as $match) {
                $name = trim($match[1]);
                $body = trim($match[2]);

                // First non-empty, non-heading line as description
                $description = '';
                foreach (explode("\n", $body) as $line) {
                    $trimmed = trim($line);
                    if ($trimmed !== '' && !str_starts_with($trimmed, '#')) {
                        $description = $trimmed;
                        break;
                    }
                }

                $skills[] = [
                    'name' => $name,
                    'description' => $description,
                    'type' => 'heading',
                    'content' => $body,
                ];
            }
        }

        return $skills;
    }

    /**
     * @return array<array{name: string, description: string, type: string, content: string}>
     */
    private function matchPluginJson(string $content): array
    {
        $skills = [];

        if (preg_match_all('/```(?:json)?\s*\n(\{[^`]*?"(?:name|plugin_name)"[^`]*?\})\s*\n```/s', $content, $matches)) {
            foreach ($matches[1] as $jsonStr) {
                $data = json_decode($jsonStr, true);
                if (!is_array($data)) continue;

                $name = $data['name'] ?? $data['plugin_name'] ?? '';
                if ($name === '') continue;

                $skills[] = [
                    'name' => (string) $name,
                    'description' => (string) ($data['description'] ?? ''),
                    'type' => 'plugin_json',
                    'content' => $jsonStr,
                ];
            }
        }

        return $skills;
    }

    /**
     * Simple YAML key-value parser.
     * @return array<string, string>
     */
    private function parseSimpleYaml(string $yamlText): array
    {
        $result = [];

        foreach (explode("\n", $yamlText) as $line) {
            $trimmed = trim($line);
            if ($trimmed === '' || str_starts_with($trimmed, '#')) continue;

            $colonPos = strpos($trimmed, ':');
            if ($colonPos === false) continue;

            $key = trim(substr($trimmed, 0, $colonPos));
            $value = trim(substr($trimmed, $colonPos + 1));

            // Remove surrounding quotes
            if (
                (str_starts_with($value, '"') && str_ends_with($value, '"')) ||
                (str_starts_with($value, "'") && str_ends_with($value, "'"))
            ) {
                $value = substr($value, 1, -1);
            }

            $result[$key] = $value;
        }

        return $result;
    }
}
