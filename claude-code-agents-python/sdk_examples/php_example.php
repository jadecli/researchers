<?php

declare(strict_types=1);

/**
 * PHP SDK example: create message, tool use, and streaming
 * with the Anthropic API.
 *
 * Requirements: PHP 8.2+ with curl extension.
 */

const API_URL = 'https://api.anthropic.com/v1/messages';

function getApiKey(): string
{
    $key = getenv('ANTHROPIC_API_KEY');
    if (!$key) {
        throw new RuntimeException('ANTHROPIC_API_KEY environment variable is not set');
    }
    return $key;
}

/**
 * Send a request to the Anthropic API.
 *
 * @param array<string, mixed> $body
 * @param bool $stream
 * @return array<string, mixed>|resource
 */
function sendRequest(array $body, bool $stream = false): mixed
{
    $ch = curl_init(API_URL);
    if ($ch === false) {
        throw new RuntimeException('Failed to initialize cURL');
    }

    $headers = [
        'Content-Type: application/json',
        'x-api-key: ' . getApiKey(),
        'anthropic-version: 2023-06-01',
    ];

    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_HTTPHEADER => $headers,
        CURLOPT_POSTFIELDS => json_encode($body),
        CURLOPT_RETURNTRANSFER => !$stream,
    ]);

    if ($stream) {
        curl_setopt($ch, CURLOPT_WRITEFUNCTION, function ($ch, string $data) {
            $lines = explode("\n", $data);
            foreach ($lines as $line) {
                $line = trim($line);
                if (empty($line) || !str_starts_with($line, 'data: ')) {
                    continue;
                }
                $jsonStr = substr($line, 6);
                if ($jsonStr === '[DONE]') {
                    break;
                }
                $event = json_decode($jsonStr, true);
                if (
                    isset($event['type']) &&
                    $event['type'] === 'content_block_delta' &&
                    isset($event['delta']['type']) &&
                    $event['delta']['type'] === 'text_delta'
                ) {
                    echo $event['delta']['text'];
                }
            }
            return strlen($data);
        });
        curl_exec($ch);
        curl_close($ch);
        return [];
    }

    $response = curl_exec($ch);
    $httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($httpCode !== 200) {
        throw new RuntimeException("API returned HTTP {$httpCode}: {$response}");
    }

    /** @var array<string, mixed> */
    return json_decode((string) $response, true);
}

/**
 * Basic message creation.
 */
function createMessageExample(): void
{
    $response = sendRequest([
        'model' => 'claude-sonnet-4-20250514',
        'max_tokens' => 1024,
        'messages' => [
            ['role' => 'user', 'content' => 'Explain quantum computing in one paragraph.'],
        ],
    ]);

    $content = $response['content'][0] ?? null;
    if ($content && $content['type'] === 'text') {
        echo "Response: {$content['text']}\n";
    }

    $usage = $response['usage'];
    echo "Usage: {$usage['input_tokens']} in, {$usage['output_tokens']} out\n";
}

/**
 * Tool use (function calling) example.
 */
function toolUseExample(): void
{
    $response = sendRequest([
        'model' => 'claude-sonnet-4-20250514',
        'max_tokens' => 1024,
        'tools' => [
            [
                'name' => 'get_weather',
                'description' => 'Get the current weather for a given location.',
                'input_schema' => [
                    'type' => 'object',
                    'properties' => [
                        'location' => [
                            'type' => 'string',
                            'description' => 'City and state, e.g. San Francisco, CA',
                        ],
                        'unit' => [
                            'type' => 'string',
                            'enum' => ['celsius', 'fahrenheit'],
                            'description' => 'Temperature unit',
                        ],
                    ],
                    'required' => ['location'],
                ],
            ],
        ],
        'messages' => [
            ['role' => 'user', 'content' => "What's the weather in San Francisco?"],
        ],
    ]);

    foreach ($response['content'] as $block) {
        if ($block['type'] === 'tool_use') {
            echo "Tool call: {$block['name']}\n";
            echo "Input: " . json_encode($block['input']) . "\n";
        }
    }
}

/**
 * Streaming response example.
 */
function streamingExample(): void
{
    sendRequest([
        'model' => 'claude-sonnet-4-20250514',
        'max_tokens' => 1024,
        'stream' => true,
        'messages' => [
            ['role' => 'user', 'content' => 'Write a haiku about programming.'],
        ],
    ], stream: true);
    echo "\n";
}

// Main
echo "=== Create Message ===\n";
createMessageExample();

echo "\n=== Tool Use ===\n";
toolUseExample();

echo "\n=== Streaming ===\n";
streamingExample();
