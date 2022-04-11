#!/usr/bin/env python3


import qrcode

def main():
    qr = qrcode.QRCode(
    version=1,
    error_correction=qrcode.constants.ERROR_CORRECT_L,
    box_size=10,
    border=4,
    )
    qr.add_data('https://www.fishipedia.fr/fr/poissons/poecilia-reticulata')
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    img.save("image/guppy.png")



if __name__ == "__main__":
    main()