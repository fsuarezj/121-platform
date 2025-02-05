import { MigrationInterface, QueryRunner } from 'typeorm';

import { MessageTemplateEntity } from '@121-service/src/notifications/message-template/message-template.entity';
import { ProgramEntity } from '@121-service/src/programs/program.entity';

export class CreateVisaMessageTemplatesPV1707916760000
  implements MigrationInterface
{
  public async up(queryRunner: QueryRunner): Promise<void> {
    // Commit transaction because the tables are needed before the insert
    await queryRunner.commitTransaction();
    await this.migrateData(queryRunner);
    // Start artifical transaction because typeorm migrations automatically tries to close a transcation after migration
    await queryRunner.startTransaction();
  }

  private async migrateData(queryRunner: QueryRunner): Promise<void> {
    const manager = queryRunner.manager;

    const messageTemplateRepository = manager.getRepository(
      MessageTemplateEntity,
    );
    const programRepository = manager.getRepository(ProgramEntity);

    const relevantPrograms = await programRepository
      .createQueryBuilder('program')
      .select('program.id as id')
      .where('program.ngo = :ngo', { ngo: 'NLRC' })
      .andWhere('program.id IN (:...ids)', { ids: [2] })
      .getRawMany();

    const newTemplates = {
      visaDebitCardCreated: {
        isSendMessageTemplate: false,
        isWhatsappTemplate: false,
        message: {
          en: 'Dear parent/carer, we have sent your grocery card by post. You will receive it within 3 weeks. The card is sent in a neutral looking envelope.\n\n- You will activate your card online via www.rodekruis.nl/boodschappenkaart-activeren and use it for the rest of the year.\n- For more information on how to activate the grocery card watch: www.schoolmaaltijden.nl/activatie\n- Every two weeks, we will put new money on your card: €[[1]].\n- You can only spend a maximum of €150 per calender month.\n- You can use the card in many shops selling food in the Netherlands.\n- The card works like normal debit cards. You will receive more information in the letter that comes with the card.\n\nQuestions? Check www.schoolmaaltijden.nl, call, sms or WhatsApp 097 010 204 851, or send an email to info@schoolmaaltijden.nl.\n\nKind regards,\nNL Red Cross / School Meals Programme',
          nl: 'Beste ouder/verzorger, we hebben uw boodschappenkaart op de post gedaan. U ontvangt de kaart binnen 3 weken. De kaart zit in een neutrale envelop.\n\n- U activeert de kaart online via www.rodekruis.nl/boodschappenkaart-activeren en gebruikt deze voor de rest van het jaar.\n- Voor meer informatie over activatie bekijk deze video: www.schoolmaaltijden.nl/activatie\n- Elke twee weken zetten we nieuw geld op de kaart: €[[1]].\n- U kunt maximaal €150 per kalendermaand besteden.\n- U kunt de kaart in allerlei winkels gebruiken die voedsel verkopen.\n- De kaart werkt als een gewone pinpas. U krijgt meer informatie in de brief die in de envelop zit.\n\nHeeft u vragen? Kijk op www.schoolmaaltijden.nl, bel, SMS of Whatsapp  097 010 204 851, of mail info@schoolmaaltijden.nl.\n\nMvg, het Rode Kruis/Programma Schoolmaaltijden',
          ar: 'عزيزي ولي الأمر / مقدم الرعاية ، لقد وضعنا بطاقة التسوق الخاصة بك في البريد. سوف تتلقى البطاقة في غضون ثلاثة أسابيع. البطاقة في مظروف أبيض.\n\n- ستفعل البطاقه اونلاين عن طريق الرابط  [www.rodekruis.nl/boodschappenkaart-activeren].\n يمكنك استخدام هذه البطاقة لبقية العام\n- لمزيد من المعلومات حول كيفية تنشيط مشاهدة بطاقة البقالة هذه: www.schoolmaaltijden.nl/activatie\n- كل أسبوعين نضع أموالا جديدة على البطاقة €[[1]]\n- يمكنك فقط إنفاق ما يصل إلى 150 يورو في الشهر الواحد.\n- يمكنك استخدام البطاقة في جميع أنواع المتاجر التي تبيع المواد الغذائية\n- تعمل البطاقة مثل بطاقة البنك العادية. سوف تتلقى المزيد من المعلومات في الرسالة الموجودة في الظرف\n\nهل لديك أي أسئلة؟ تحقق من www.schoolmaaltijden.nl أو اتصل أو أرسل رسالة نصية قصيرة  أو واتس اب  على 097010204851 أو ارسل بريدا إلكترونيا info@schoolmaaltijden.nl\n\nمع تحيات\nالصليب الأحمر / برنامج الوجبات المدرسية',
          tr: 'Sevgili veli/bakıcı, alışveriş kartınızı posta ile gönderdik. Kartı 3 hafta içinde alırsınız. Kart, göze çarpmayan bir zarf içinde gelir.\n\n- Kartı online olarak aktive edersiniz [www.rodekruis.nl/boodschappenkaart-activeren] ve bunu yılın geri kalanı için kullanırsınız.\n- Etkinleştirme hakkında daha fazla bilgi için www.schoolmaaltijden.nl/activatie\n- İki haftada bir karta yeni tutar yüklemesi yapacağız: €[[1]].\n- Bir takvim ayında en fazla 150€ harcayabilirsiniz.\n- Kartı yiyecek satışı yapan çeşitli mağazalarda kullanabilirsiniz.\n- Kartın işleyişi normal ödeme kartı ile aynıdır. Daha fazla bilgiyi zarftaki mektupta bulabilirsiniz.\n\nSorularınız olursa, www.schoolmaaltijden.nl internet sitesini ziyaret edebilir, 097 010 204 851 numaralı telefona çağrı, mesaj ya da Whatsapp yoluyla ulaşabilir, veya info@schoolmaaltijden.nl adresine e-posta gönderebilirsiniz.\n\nSaygılarımızla, Rode Kruis/Programma Schoolmaaltijden',
        },
      },
      visaLoad: {
        isSendMessageTemplate: false,
        isWhatsappTemplate: false,
        message: {
          en: 'Dear parent/carer, we have put new money on your card: €[[1]] for the coming two weeks. You can only spend a maximum of €150 per calender month. \nBefore using the grocery card, please check the balance via www.rodekruis.nl/boodschappenkaart.\n\nQuestions? Check www.schoolmaaltijden.nl, call, sms or WhatsApp 097 010 204 851, or send an email to info@schoolmaaltijden.nl.\n\nKind regards,\nNL Red Cross / School Meals Programme',
          nl: 'Beste ouder/verzorger, we hebben geld op uw boodschappenkaart gezet: €[[1]] voor de komende twee weken. U kunt maximaal €150 per kalendermaand besteden.\nControleer het bedrag op uw kaart via www.rodekruis.nl/boodschappenkaart voor u de kaart gebruikt.\n\nHeeft u vragen? Kijk op www.schoolmaaltijden.nl, bel, SMS of Whatsapp  097 010 204 851, of mail info@schoolmaaltijden.nl.\n\nMvg, het Rode Kruis/Programma Schoolmaaltijden',
          ar: 'عزيزي ولي الأمر/ مقدم الرعاية ، لقد وضعنا المال  على بطاقتك للأسبوعين المقبلين بقيمة €[[1]] برجاء استخدام هذا المبلغ خلال شهر. يمكنك فقط إنفاق ما يصل إلى 150 يورو في الشهر الواحد.   تحقق من المبلغ الموجود على بطاقتك قبل استخدام البطاقه عبر الرابط: [www.rodekruis.nl/boodschappenkaart]\n\nهل لديك أي أسئلة؟ تحقق من www.schoolmaaltijden.nl أو اتصل أو أرسل رسالة نصية قصيرة أو واتس اب على 097010204851 أو أرسل بريدا إلكترونيا الى info@schoolmaaltijden.nl\n\nمع تحيات الصليب الأحمر / برنامج الوجبات المدرسية',
          tr: 'Sevgili veli/bakıcı, kartınıza para yükledik: €[[1]] (önümüzdeki iki hafta için). Lütfen ilgili tutarı bir ay içinde kullanın. Bir takvim ayında en fazla 150€ harcayabilirsiniz. Kartı kullanmadan önce karttaki tutarı [www.rodekruis.nl/boodschappenkaart] üzerinden kontrol edin.\n\nSorularınız olursa, www.schoolmaaltijden.nl internet sitesini ziyaret edebilir, 097 010 204 851 numaralı telefona çağrı, mesaj ya da Whatsapp yoluyla ulaşabilir, veya info@schoolmaaltijden.nl adresine e-posta gönderebilirsiniz.\n\nSaygılarımızla, Rode Kruis/Programma Schoolmaaltijden',
        },
      },
      reissueVisaCard: {
        isSendMessageTemplate: false,
        isWhatsappTemplate: false,
        message: {
          en: 'Dear parent/carer, a new grocery card is sent to your address. You will receive it within three weeks. School Meals',
          nl: 'Beste ouder/verzorger, we hebben u een nieuwe boodschappenkaart gestuurd. U ontvangt deze binnen drie weken. Schoolmaaltijden',
          ar: 'عزيزي الوالد / مقدم الرعاية ، لقد أرسلنا لك بطاقة تسوق جديدة. سوف تحصل عليها في غضون ثلاثة أسابيع. الوجبات المدرسية',
          tr: 'Sevgili veli/bakıcı, yeni alışveriş kartınızı gönderdik. Kartı 3 hafta içinde alırsınız. Okul Öğünleri',
        },
      },
      blockVisaCard: {
        isSendMessageTemplate: false,
        isWhatsappTemplate: false,
        message: {
          en: 'Dear parent/carer, your grocery card is blocked. If you do not know why, please contact customer service: call or whatsapp 097 010 204 851. School Meals',
          nl: 'Beste ouder/verzorger, uw boodschappenkaart is geblokkeerd. Als u niet weet waarom, bel of WhatsApp 097 010 204 851. Schoolmaaltijden',
          ar: 'عزيزي الوالد / مقدم الرعاية ، تم حظر بطاقة التسوق الخاصة بك. إذا كنت لا تعرف السبب ، فاتصل أو ارسل على واتساب 097010204851 .الوجبات المدرسية',
          tr: 'Sevgili veli/bakıcı, alışveriş kartınız bloke edildi. Eğer nedenini bilmiyorsanız, 097 010 204 851 nolu telefonu arayın ya da Whatsapp mesajı gönderin. Okul Öğünleri',
        },
      },
      unblockVisaCard: {
        isSendMessageTemplate: false,
        isWhatsappTemplate: false,
        message: {
          en: 'Dear parent/carer, your grocery card is unblocked. You can use the card again. Questions? Call or whatsapp 097 010 204 851. School Meals',
          nl: 'Beste ouder/verzorger, uw boodschappenkaart is gedeblokkeerd. U kunt de kaart weer gebruiken. Vragen? Bel of WhatsApp 097 010 204 851. Schoolmaaltijden',
          ar: ' عزيزي الوالد / مقدم الرعاية ، تم إلغاء حظر بطاقة التسوق الخاصة بك. يمكنك استخدام البطاقة مرة أخرى. للاسئلة؟ اتصل أو واتساب على097010204851. الوجبات المدرسية',
          tr: 'Sevgili veli/bakıcı, alışveriş kartınızın blokajı açıldı. Kartı yeniden kullanabilirsiniz. Sorunuz var mı? 097 010 204 851 numaralı telefonu arayın ya da Whatsapp mesajı gönderin. Okul Öğünleri',
        },
      },
    };

    for (const program of relevantPrograms) {
      for (const type of Object.keys(newTemplates)) {
        for (const language of Object.keys(newTemplates[type].message)) {
          const template = {
            type,
            language,
            isSendMessageTemplate: newTemplates[type].isSendMessageTemplate,
            isWhatsappTemplate: newTemplates[type].isWhatsappTemplate,
            message: newTemplates[type].message[language],
            programId: program.id,
          };
          await messageTemplateRepository.save(template);
        }
      }
    }
  }
  public async down(_queryRunner: QueryRunner): Promise<void> {
    // Nothing to do
  }
}
