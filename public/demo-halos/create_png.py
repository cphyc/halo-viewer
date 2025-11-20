# Create a minimal PNG using raw bytes
def create_simple_png(filename, color_r, color_g, color_b):
    width, height = 200, 150
    
    # PNG header
    png_header = b'\x89PNG\r\n\x1a\n'
    
    # IHDR chunk
    import struct
    import zlib
    
    ihdr_data = struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0)
    ihdr_crc = zlib.crc32(b'IHDR' + ihdr_data) & 0xffffffff
    ihdr = struct.pack('>I', 13) + b'IHDR' + ihdr_data + struct.pack('>I', ihdr_crc)
    
    # IDAT chunk with image data
    raw_data = b''
    for y in range(height):
        raw_data += b'\x00'  # filter type
        for x in range(width):
            # Gradient effect
            r = (color_r * x // width) % 256
            g = (color_g * y // height) % 256
            b = color_b
            raw_data += bytes([r, g, b])
    
    compressed_data = zlib.compress(raw_data, 9)
    idat_crc = zlib.crc32(b'IDAT' + compressed_data) & 0xffffffff
    idat = struct.pack('>I', len(compressed_data)) + b'IDAT' + compressed_data + struct.pack('>I', idat_crc)
    
    # IEND chunk
    iend_crc = zlib.crc32(b'IEND') & 0xffffffff
    iend = struct.pack('>I', 0) + b'IEND' + struct.pack('>I', iend_crc)
    
    with open(filename, 'wb') as f:
        f.write(png_header + ihdr + idat + iend)

create_simple_png('halo_1_image.png', 255, 200, 100)
create_simple_png('halo_2_image.png', 100, 255, 150)
create_simple_png('halo_3_image.png', 200, 100, 255)
print("Created PNG images")
