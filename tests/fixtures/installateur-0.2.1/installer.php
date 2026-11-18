<?php
/**
 * Copie exacte de fonctions de le-socle v1.2.2 (0e60eca), l’installateur
 * embarqué dans le paquet complet Kiosque 0.2.1. Ne pas modifier la logique :
 * le test vérifie que le paquet actuel s’installe encore avec CET outil.
 */
declare(strict_types=1);


function socle_crc32(string $data): int {
    return (int) hexdec(hash('crc32b', $data));
}

function socle_zip_store(array $files, ?DateTimeImmutable $date = null): string {
    $date ??= new DateTimeImmutable('2026-01-01 00:00:00');
    $time = (($date->format('G') << 11) | ((int) $date->format('i') << 5) | ((int) $date->format('s') >> 1)) & 0xffff;
    $day = (((int) $date->format('Y') - 1980) << 9) | ((int) $date->format('n') << 5) | (int) $date->format('j');
    $locals = '';
    $centrals = '';
    $offset = 0;
    $count = 0;
    foreach ($files as $file) {
        $name = (string) $file['name'];
        $data = (string) $file['data'];
        if (str_contains($name, '..') || str_starts_with($name, '/') || str_contains($name, '\\')) {
            throw new RuntimeException('chemin refusé : ' . $name);
        }
        $crc = socle_crc32($data);
        $nameLen = strlen($name);
        $size = strlen($data);
        $local = pack('VvvvvvVVVvv', 0x04034b50, 20, 0, 0, $time, $day, $crc, $size, $size, $nameLen, 0) . $name . $data;
        // En-tête central : 17 champs (signature, versions, drapeaux, méthode, heure, date,
        // CRC, tailles, longueurs, disque, attributs, position). Sans la méthode, Windows,
        // macOS et unzip refusent l'archive.
        $central = pack('VvvvvvvVVVvvvvvVV', 0x02014b50, 20, 20, 0, 0, $time, $day, $crc, $size, $size, $nameLen, 0, 0, 0, 0, 0, $offset) . $name;
        $locals .= $local;
        $centrals .= $central;
        $offset += strlen($local);
        $count += 1;
    }
    $centralSize = strlen($centrals);
    $eocd = pack('VvvvvVVv', 0x06054b50, 0, 0, $count, $count, $centralSize, $offset, 0);
    return $locals . $centrals . $eocd;
}

function socle_unzip(string $data): array {
    $files = [];
    $offset = 0;
    $length = strlen($data);
    while ($offset + 4 <= $length) {
        $signature = unpack('V', substr($data, $offset, 4))[1];
        if ($signature !== 0x04034b50) break;
        $method = unpack('v', substr($data, $offset + 8, 2))[1];
        $size = unpack('V', substr($data, $offset + 18, 4))[1];
        $nameLength = unpack('v', substr($data, $offset + 26, 2))[1];
        $extra = unpack('v', substr($data, $offset + 28, 2))[1];
        $name = substr($data, $offset + 30, $nameLength);
        if ($method !== 0) throw new RuntimeException('compression non lue : ' . $name);
        if (str_contains($name, '..') || str_starts_with($name, '/') || str_contains($name, '\\')) {
            throw new RuntimeException('chemin refusé : ' . $name);
        }
        $start = $offset + 30 + $nameLength + $extra;
        $files[$name] = substr($data, $start, $size);
        $offset = $start + $size;
    }
    return $files;
}

function socle_text_file(string $name, string $text): array {
    return ['name' => $name, 'data' => $text];
}

const SOCLE_MAJ_DIRS = ['php', 'admin', 'site'];

function socle_root(): string {
    $root = getenv('SOCLE_TEST_ROOT');
    if (!is_string($root) || $root === '') throw new RuntimeException('SOCLE_TEST_ROOT manquant');
    return $root;
}


function socle_remove_tree(string $dir): void {
    if (!is_dir($dir)) return;
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($dir, FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::CHILD_FIRST);
    foreach ($iterator as $item) {
        if ($item->isDir()) @rmdir($item->getPathname());
        else @unlink($item->getPathname());
    }
    @rmdir($dir);
}

/**
 * Remplace le programme par ces fichiers (chemins relatifs à la racine du
 * paquet). donnees/ n'est jamais touché ; les dossiers du programme sont
 * vidés d'abord pour qu'un fichier retiré par la nouvelle version disparaisse.
 */
function socle_install_program(array $files): void {
    $root = socle_root();
    foreach (array_keys($files) as $name) {
        if (!is_string($name) || $name === '' || str_contains($name, '..') || str_starts_with($name, '/') || str_starts_with($name, 'donnees/')) throw new RuntimeException('chemin refusé : ' . $name);
    }
    foreach (SOCLE_MAJ_DIRS as $dir) socle_remove_tree($root . '/' . $dir);
    foreach ($files as $name => $data) {
        $target = $root . '/' . $name;
        if (str_ends_with($name, '/')) continue;
        $dir = dirname($target);
        if (!is_dir($dir) && !mkdir($dir, 0775, true) && !is_dir($dir)) throw new RuntimeException('dossier non créé : ' . $name);
        if (file_put_contents($target, $data) === false) throw new RuntimeException('fichier non écrit : ' . $name);
    }
    if (function_exists('opcache_reset')) @opcache_reset();
}

/** Lit un ZIP de paquet et rend ses fichiers sans le dossier racine. */
function socle_paquet_files(string $zip): array {
    $entries = socle_unzip($zip);
    $root = null;
    foreach (array_keys($entries) as $name) {
        $first = explode('/', (string) $name)[0];
        if ($root === null) $root = $first;
        if ($first !== $root) throw new RuntimeException('le ZIP doit contenir un seul dossier');
    }
    if ($root === null || !isset($entries[$root . '/index.php'], $entries[$root . '/paquet.json'], $entries[$root . '/php/src/bootstrap.php'])) {
        throw new RuntimeException('ce ZIP n’est pas un paquet complet du Kiosque');
    }
    $files = [];
    foreach ($entries as $name => $data) {
        $relative = substr((string) $name, strlen($root) + 1);
        if ($relative === '' || str_starts_with($relative, 'donnees/')) continue;
        $files[$relative] = $data;
    }
    return $files;
}

if (PHP_SAPI === 'cli' && isset($argv[1])) {
    $cmd = $argv[1];
    if ($cmd === 'unpack' && isset($argv[2])) {
        $files = socle_paquet_files((string) file_get_contents($argv[2]));
        echo json_encode(array_keys($files), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), "\n";
        exit(0);
    }
    if ($cmd === 'apply' && isset($argv[2], $argv[3])) {
        putenv('SOCLE_TEST_ROOT=' . $argv[3]);
        $files = socle_paquet_files((string) file_get_contents($argv[2]));
        socle_install_program($files);
        echo "ok\n";
        exit(0);
    }
    fwrite(STDERR, "usage: unpack <zip> | apply <zip> <dest>\n");
    exit(2);
}
