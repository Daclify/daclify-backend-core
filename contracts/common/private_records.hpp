#pragma once
#include "records.hpp"
namespace daclify {
struct private_record_reference {
 uint64_t document_id;uint32_t version;checksum256 commitment;uint64_t key_epoch;
 EOSLIB_SERIALIZE(private_record_reference,(document_id)(version)(commitment)(key_epoch))
};
inline document_record protected_document(name runtime,uint64_t dao_id,const private_record_reference& ref,bool current_epoch=true){
 check(ref.document_id&&ref.version&&ref.key_epoch,"PRIVATE_CONTENT_REFERENCE");
 const auto dao=daos(runtime,runtime.value).get(dao_id,"DAO_UNKNOWN");check(dao.privacy>0&&(!current_epoch||ref.key_epoch==dao.key_epoch),"PRIVATE_CONTENT_EPOCH");
 documents docs(runtime,dao_id);auto versions=docs.get_index<"byversion"_n>();const auto& doc=versions.get((uint128_t(ref.document_id)<<32)|ref.version,"DOCUMENT_UNKNOWN");
 check(doc.envelope_version==1&&doc.key_epoch==ref.key_epoch&&doc.commitment==ref.commitment,"PRIVATE_CONTENT_REFERENCE");return doc;
}
}
